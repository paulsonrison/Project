import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import request from 'supertest';
import {MongoClient} from 'mongodb';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {createApp} from '../app.js';
import {createIndexes} from '../db/connect.js';
import {parseWorkbook} from './workbook.js';
import {randomUUID} from 'node:crypto';
describe('integration Excel upload boundary',()=>{
  let mongo:MongoMemoryReplSet,client:MongoClient,app:ReturnType<typeof createApp>;
  const origin='http://localhost:5173';
  beforeAll(async()=>{mongo=await MongoMemoryReplSet.create({replSet:{count:1}});client=await new MongoClient(mongo.getUri()).connect();await createIndexes(client.db('upload'));app=createApp({client,db:client.db('upload'),config:{mongoUri:mongo.getUri(),database:'upload',origin,port:3001,production:false,groqModel:'test'}});},120000);
  afterAll(async()=>{await client?.close();await mongo?.stop();});
  async function owner(email:string){const agent=request.agent(app);expect((await agent.post('/api/v1/auth/register').set('Origin',origin).send({email,password:'test-password-12345',name:'Owner',society:'Delivery desk'})).status).toBe(201);return agent;}
  it('rejects unauthenticated and malformed file uploads without creating customer records',async()=>{
    expect((await request(app).post('/api/v1/imports/upload').set('Origin',origin).attach('file',Buffer.from('bad'),{filename:'bad.xlsx'})).status).toBe(401);
    const a=await owner('invalid-upload@example.test');
    expect((await a.post('/api/v1/imports/upload').set('Origin',origin).attach('file',Buffer.from('bad'),{filename:'bad.xlsx'})).status).toBe(400);
    expect((await a.get('/api/v1/residents')).body.items).toEqual([]);
  });
  it('matches template mode and preserves the entire explicit replacement selection',async()=>{
    const a=await owner('template-upload@example.test');
    const first=(await a.post('/api/v1/residents').set('Origin',origin).send({name:'Anu',unit:'001'})).body;
    const second=(await a.post('/api/v1/residents').set('Origin',origin).send({name:'Binu',unit:'002'})).body;
    const response=await a.post('/api/v1/imports/template').set('Origin',origin).send({entity:'residents',mode:'replace',selection:[first.id]}).buffer(true).parse((res,done)=>{const chunks:Buffer[]=[];res.on('data',(chunk:Buffer)=>chunks.push(chunk));res.on('end',()=>done(null,Buffer.concat(chunks)));});
    expect(response.status).toBe(200);
    const parsed=await parseWorkbook(response.body as Buffer);
    expect(parsed.rows).toHaveLength(1);expect(parsed.rows[0]['Customer ID']).toBe(first.id);
    expect((await a.post('/api/v1/imports/preview').set('Origin',origin).send({entity:'residents',mode:'update',templateId:parsed.templateId,rows:parsed.rows})).status).toBe(400);
    const missing=await a.post('/api/v1/imports/preview').set('Origin',origin).send({entity:'residents',mode:'replace',templateId:parsed.templateId,rows:[]});
    expect(missing.body.errors).not.toHaveLength(0);
    expect((await a.post(`/api/v1/imports/${missing.body.id}/commit`).set('Origin',origin).send({})).status).toBe(409);
    parsed.rows[0].Name='Updated';
    const preview=await a.post('/api/v1/imports/preview').set('Origin',origin).send({entity:'residents',mode:'replace',templateId:parsed.templateId,rows:parsed.rows});
    expect(preview.body.errors).toEqual([]);
    expect((await a.post(`/api/v1/imports/${preview.body.id}/commit`).set('Origin',origin).send({})).status).toBe(200);
    const customers=(await a.get('/api/v1/residents')).body.items;
    expect(customers.find((r:{id:string})=>r.id===second.id).name).toBe('Binu');
    expect(customers.find((r:{id:string})=>r.id===first.id).name).toBe('Updated');
  });
  it('serializes competing manual and imported subscriptions for the same customer and publication',async()=>{
    const a=await owner('concurrent-manual@example.test');
    const resident=(await a.post('/api/v1/residents').set('Origin',origin).send({name:'Reader',unit:'C1'})).body;
    const paper=(await a.post('/api/v1/publications').set('Origin',origin).send({name:'Paper',code:'MM',basePrice:600,schedule:'daily'})).body;
    const preview=await a.post('/api/v1/imports/preview').set('Origin',origin).send({entity:'residents',mode:'update',effectiveDate:'2090-01-01',rows:[{'Customer ID':resident.id,Revision:'0','Subscription: MM':'1'}]});
    expect(preview.body.errors).toEqual([]);
    const results=await Promise.all([
      a.post(`/api/v1/imports/${preview.body.id}/commit`).set('Origin',origin).send({}),
      a.post('/api/v1/subscriptions').set('Origin',origin).send({residentId:resident.id,publicationId:paper.id,quantity:1,startDate:'2090-01-01'}),
    ]);
    expect(results.filter(result=>result.status<300)).toHaveLength(1);
    expect((await a.get('/api/v1/subscriptions')).body.items).toHaveLength(1);
  });
  it('limits the AI boundary to explicitly reviewed nonpersonal newspaper choices',async()=>{
    const a=await owner('private-ai@example.test');
    await a.post('/api/v1/publications').set('Origin',origin).send({name:'The Hindu',code:'HD',basePrice:600,schedule:'daily'});
    const input={startDate:'2090-01-01',selections:[{code:'HD',quantity:1}]};
    expect((await a.post('/api/v1/ai-entry/payload').set('Origin',origin).send({...input,address:'Private home'})).status).toBe(400);
    const payload=await a.post('/api/v1/ai-entry/payload').set('Origin',origin).send(input);
    expect(payload.status).toBe(200);
    expect(payload.body.payload).toEqual({startDate:'2090-01-01',publications:[{code:'HD',name:'The Hindu',quantity:1}]});
    expect((await a.post('/api/v1/ai-entry/propose').set('Origin',origin).send({request:{...input,consentToGroq:false},expectedPayloadHash:payload.body.hash})).status).toBe(400);
    expect((await a.post('/api/v1/ai-entry/propose').set('Origin',origin).send({request:{...input,consentToGroq:true},expectedPayloadHash:'0'.repeat(64)})).status).toBe(409);
    expect((await a.post('/api/v1/ai-entry/propose').set('Origin',origin).send({request:{...input,consentToGroq:true},expectedPayloadHash:payload.body.hash})).status).toBe(503);
    expect((await a.get('/api/v1/residents')).body.items).toEqual([]);
  });
  it('records a retrospective debit without rewriting the invoice and releases excess payment on reversal',async()=>{
    const a=await owner('debit-review@example.test');
    const session=(await a.get('/api/v1/auth/session')).body,id=randomUUID();
    await client.db('upload').collection('invoices').insertOne({id,societyId:session.societyId,residentId:randomUUID(),revision:0,totalMinor:100,status:'issued',month:'2026-01',lines:[]});
    const charge=await a.post('/api/v1/adjustments').set('Origin',origin).set('Idempotency-Key','retrospective-debit').send({invoiceId:id,amountMinor:50,direction:'debit',reference:'Confirmed old rate correction'});
    expect(charge.status).toBe(201);expect(charge.body.amountMinor).toBe(-50);
    const invoice=(await a.get('/api/v1/invoices')).body.items[0];expect(invoice.totalMinor).toBe(100);expect(invoice.dueMinor).toBe(150);
    await a.post('/api/v1/payments').set('Origin',origin).set('Idempotency-Key','payment-for-debit').send({invoiceId:id,amountMinor:150,reference:'Cash'});
    expect((await a.post(`/api/v1/adjustments/${charge.body.id}/reverse`).set('Origin',origin).send({reason:'Correction cancelled'})).status).toBe(200);
    const final=(await a.get('/api/v1/invoices')).body.items[0];expect(final.totalMinor).toBe(100);expect(final.dueMinor).toBe(0);expect(final.creditMinor).toBe(50);
  });
  it('refuses a debit reversal that would leave credits above the original invoice value',async()=>{
    const a=await owner('debit-cap@example.test'),scope=(await a.get('/api/v1/auth/session')).body,id=randomUUID();
    await client.db('upload').collection('invoices').insertOne({id,societyId:scope.societyId,residentId:randomUUID(),revision:0,totalMinor:100,status:'issued',month:'2026-01',lines:[]});
    const charge=await a.post('/api/v1/adjustments').set('Origin',origin).set('Idempotency-Key','debit-before-credit').send({invoiceId:id,amountMinor:100,direction:'debit',reference:'Extra copies'});
    expect((await a.post('/api/v1/adjustments').set('Origin',origin).set('Idempotency-Key','credit-after-debit').send({invoiceId:id,amountMinor:150,reference:'Accepted return'})).status).toBe(201);
    expect((await a.post(`/api/v1/adjustments/${charge.body.id}/reverse`).set('Origin',origin).send({reason:'Remove extra charge'})).status).toBe(409);
    const final=(await a.get('/api/v1/invoices')).body.items[0];expect(final.totalMinor).toBe(100);expect(final.dueMinor).toBe(50);
  });
});

