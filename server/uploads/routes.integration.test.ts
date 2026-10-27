import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import request from 'supertest';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {MongoClient} from 'mongodb';
import {createApp} from '../app.js';
import {createIndexes} from '../db/connect.js';
describe('integration unified private uploads',()=>{
 let mongo:MongoMemoryReplSet,client:MongoClient,app:ReturnType<typeof createApp>;
 const origin='http://localhost:5173';
 beforeAll(async()=>{mongo=await MongoMemoryReplSet.create({replSet:{count:1}});client=await new MongoClient(mongo.getUri()).connect();const db=client.db('unified');await createIndexes(db);app=createApp({db,client,config:{mongoUri:mongo.getUri(),database:'unified',origin,port:3001,production:false,groqModel:'test'}});},120000);
 afterAll(async()=>{await client?.close();await mongo?.stop();});
 async function owner(email:string){const a=request.agent(app);expect((await a.post('/api/v1/auth/register').set('Origin',origin).send({name:'Owner',society:'Unified',email,password:'synthetic-password-12345'})).status).toBe(201);return a;}
 async function ready(a:ReturnType<typeof request.agent>,id:string){for(let i=0;i<100;i++){const response=await a.get(`/api/v1/uploads/${id}`);if(!['uploaded','extracting','interpreting'].includes(response.body.status))return response.body;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('Upload did not finish');}
 it('reads ordinary CSV, isolates jobs and saves only the reviewed transaction exactly once',async()=>{
  const a=await owner('upload-a@example.test'),b=await owner('upload-b@example.test');
  const upload=await a.post('/api/v1/uploads').set('Origin',origin).field('entity','residents').attach('file',Buffer.from('Full name,Mobile,Flat\nAnu,0012345678,001\nBinu,+919000001111,002'),{filename:'customers.csv'});
  expect(upload.status).toBe(202);expect((await b.get(`/api/v1/uploads/${upload.body.id}`)).status).toBe(404);
  const job=await ready(a,upload.body.id);expect(job.status).toBe('needs-review');expect(job.rows[0]).toMatchObject({Name:'Anu',Number:'0012345678','Address/Flat':'001'});
  expect((await a.get('/api/v1/residents')).body.items).toHaveLength(0);
  const preview=await a.post(`/api/v1/uploads/${job.id}/preview`).set('Origin',origin).send({rows:job.rows,revision:job.revision});expect(preview.body.errors).toEqual([]);
  const save=()=>a.post(`/api/v1/uploads/${job.id}/save`).set('Origin',origin).send({batchId:preview.body.id});
  expect((await save()).status).toBe(200);expect((await save()).status).toBe(200);
  expect((await a.get('/api/v1/residents')).body.items).toHaveLength(2);expect((await a.get(`/api/v1/uploads/${job.id}`)).body.rows).toBeUndefined();
 });
 it('rejects anonymous uploads, unknown files and cancellation before any business writes',async()=>{
  expect((await request(app).post('/api/v1/uploads').set('Origin',origin).field('entity','residents').attach('file',Buffer.from('Name,Flat\nAnu,001'),{filename:'a.csv'})).status).toBe(401);
  const a=await owner('upload-invalid@example.test');
  const invalid=await a.post('/api/v1/uploads').set('Origin',origin).field('entity','residents').attach('file',Buffer.from('binary'),{filename:'unknown.exe'});
  const failed=await ready(a,invalid.body.id);expect(failed.status).toBe('failed');
  const upload=await a.post('/api/v1/uploads').set('Origin',origin).field('entity','residents').attach('file',Buffer.from('Name,Flat\nAnu,001'),{filename:'a.csv'});
  const job=await ready(a,upload.body.id);expect((await a.delete(`/api/v1/uploads/${job.id}`).set('Origin',origin)).status).toBe(204);
  expect((await a.post(`/api/v1/uploads/${job.id}/preview`).set('Origin',origin).send({rows:job.rows,revision:job.revision})).status).toBe(409);
  expect((await a.get('/api/v1/residents')).body.items).toHaveLength(0);
 });
});
