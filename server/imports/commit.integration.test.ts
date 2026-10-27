import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { createPreview, commitPreview } from './service.js';
import type { AccessScope } from '../../shared/contracts.js';
describe('integration reviewed import', () => {
  let mongo: MongoMemoryReplSet, client: MongoClient;
  const scope: AccessScope = { societyId: 'business-a', userId: 'owner', role: 'admin' };
  beforeAll(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri()).connect(); }, 120000);
  afterAll(async () => { await client?.close(); await mongo?.stop(); });
  it('commits once and never writes invalid rows', async () => {
    const db = client.db('imports');
    const invalid = await createPreview(db, scope, { entity: 'residents', mode: 'add', rows: [{ Name: 'Bad' }] });
    expect(invalid.errors).toHaveLength(1);
    await expect(commitPreview(db, client, scope, invalid.id)).rejects.toThrow();
    expect(await db.collection('residents').countDocuments()).toBe(0);
    const preview = await createPreview(db, scope, { entity: 'residents', mode: 'add', rows: [{ Name: 'Anu', 'Address/Flat': '001', Number: '+919000000001' }] });
    expect(preview.errors).toEqual([]);
    const result = await commitPreview(db, client, scope, preview.id);
    expect(await commitPreview(db, client, scope, preview.id)).toEqual(result);
    expect(await db.collection('residents').countDocuments()).toBe(1);
  });
  it('checks scope and revisions again at commit', async () => {
    const db = client.db('conflicts'), id = randomUUID();
    await db.collection('residents').insertOne({ id, societyId: scope.societyId, revision: 0, name: 'Old', unit: 'A1' });
    const preview = await createPreview(db, scope, { entity: 'residents', mode: 'update', rows: [{ 'Customer ID': id, Revision: '0', Name: 'Changed' }] });
    await expect(commitPreview(db, client, { ...scope, societyId: 'foreign' }, preview.id)).rejects.toThrow();
    await db.collection('residents').updateOne({ id }, { $inc: { revision: 1 } });
    await expect(commitPreview(db, client, scope, preview.id)).rejects.toThrow(/changed/i);
    expect((await db.collection('residents').findOne({ id }))?.name).toBe('Old');
  });
  it('rejects duplicate records created after preview', async()=>{
    const db=client.db('duplicate-race');
    const input={entity:'residents' as const,mode:'add' as const,rows:[{Name:'Anu','Address/Flat':'001'}]};
    const a=await createPreview(db,scope,input),b=await createPreview(db,scope,input);
    await commitPreview(db,client,scope,a.id);
    await expect(commitPreview(db,client,scope,b.id)).rejects.toThrow(/duplicate|changed/i);
    expect(await db.collection('residents').countDocuments()).toBe(1);
  });
  it('rejects subscription and paper changes made after the preview',async()=>{
    const db=client.db('subscription-race'),residentId=randomUUID(),publicationId=randomUUID();
    await db.collection('residents').insertOne({id:residentId,societyId:scope.societyId,revision:0,name:'Anu',unit:'001'});
    await db.collection('publications').insertOne({id:publicationId,societyId:scope.societyId,revision:0,name:'MM',code:'MM',basePrice:600,schedule:'daily'});
    const preview=await createPreview(db,scope,{entity:'residents',mode:'update',rows:[{'Customer ID':residentId,Revision:'0','Subscription: MM':'1','Start Date':'2090-01-01'}]});
    expect(preview.errors).toEqual([]);
    await db.collection('subscriptions').insertOne({id:randomUUID(),societyId:scope.societyId,revision:0,residentId,publicationId,quantity:2,startDate:'2090-01-01'});
    await expect(commitPreview(db,client,scope,preview.id)).rejects.toThrow(/changed/i);
    const second=await createPreview(db,scope,{entity:'residents',mode:'update',rows:[{'Customer ID':residentId,Revision:'0',Name:'New name'}]});
    await db.collection('publications').updateOne({id:publicationId},{$inc:{revision:1}});
    await expect(commitPreview(db,client,scope,second.id)).rejects.toThrow(/changed/i);
  });
  it('does not archive past recorded deliveries',async()=>{
    const db=client.db('archive-history'),id=randomUUID();
    await db.collection('residents').insertOne({id,societyId:scope.societyId,revision:0,name:'Anu',unit:'001'});
    await db.collection('deliveries').insertOne({id:randomUUID(),societyId:scope.societyId,residentId:id,date:'2026-10-20',status:'delivered'});
    const preview=await createPreview(db,scope,{entity:'residents',mode:'remove',effectiveDate:'2026-10-01',rows:[{'Customer ID':id,Revision:'0','Remove?':'Yes'}]});
    expect(preview.errors).toHaveLength(1);
  });
  it('serializes simultaneous duplicate creates and rechecks new delivery history',async()=>{
    const db=client.db('concurrent-imports'),input={entity:'residents' as const,mode:'add' as const,rows:[{Name:'Anu','Address/Flat':'001'}]};
    const a=await createPreview(db,scope,input),b=await createPreview(db,scope,input);
    const outcomes=await Promise.allSettled([commitPreview(db,client,scope,a.id),commitPreview(db,client,scope,b.id)]);
    expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(await db.collection('residents').countDocuments()).toBe(1);
    const resident=(await db.collection('residents').findOne({}))!;
    const removal=await createPreview(db,scope,{entity:'residents',mode:'remove',effectiveDate:'2090-01-01',rows:[{'Customer ID':resident.id,Revision:'0','Remove?':'Yes'}]});
    expect(removal.errors).toEqual([]);
    await db.collection('deliveries').insertOne({societyId:scope.societyId,residentId:resident.id,date:'2090-01-01',status:'delivered'});
    await expect(commitPreview(db,client,scope,removal.id)).rejects.toThrow(/history changed/i);
    expect((await db.collection('residents').findOne({id:resident.id}))?.archived).not.toBe(true);
  });
});
