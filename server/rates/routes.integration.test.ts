import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ratesRoutes } from './routes.js';
import { ApiError } from '../auth/scope.js';

describe('integration reviewed newspaper rates',()=>{
  let mongo:MongoMemoryReplSet,client:MongoClient,app:express.Express;
  beforeAll(async()=>{
    mongo=await MongoMemoryReplSet.create({replSet:{count:1}});client=await new MongoClient(mongo.getUri()).connect();
    const db=client.db('rates');
    app=express();app.use(express.json());app.use((req,res,next)=>{res.locals.scope={societyId:req.get('test-society')??'a',role:req.get('test-role')??'admin',userId:'owner'};next();});
    app.use('/rates',ratesRoutes({db,client,config:{mongoUri:mongo.getUri(),database:'rates',origin:'http://localhost',port:3000,production:false,groqModel:'test'}}));
    app.use((e:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{void _next;res.status(e instanceof ApiError?e.status:500).json({message:e instanceof Error?e.message:'error'});});
    await db.collection('publications').insertOne({id:'paper',societyId:'a',revision:0,schedule:'daily',basePrice:600,priceHistory:[{effectiveDate:'2026-10-01',price:600}]});
    await db.collection('deliveries').insertOne({id:'job',societyId:'a',publicationId:'paper',date:'2026-10-20',priceMinor:600,billableQuantity:1,status:'delivered',invoiceId:'paid'});
  },120000);
  afterAll(async()=>{await client?.close();await mongo?.stop();});
  it('isolates tenants and requires owner access',async()=>{
    expect((await request(app).get('/rates/paper/history?month=2026-10').set('test-society','b')).status).toBe(404);
    expect((await request(app).get('/rates/paper/history?month=2026-10').set('test-role','resident')).status).toBe(403);
  });
  it('previews, commits idempotently, preserves billed snapshots and reports daily history',async()=>{
    const preview=await request(app).post('/rates/paper/preview').send({revision:0,validFrom:'2026-10-16',price:700});
    expect(preview.status).toBe(200);expect(preview.body.billedDatesUnchanged).toBe(1);
    expect((await client.db('rates').collection('publications').findOne({id:'paper'}))?.revision).toBe(0);
    expect((await request(app).post(`/rates/previews/${preview.body.id}/commit`).set('test-society','b').send({})).status).toBe(404);
    expect((await request(app).post(`/rates/previews/${preview.body.id}/commit`).send({})).status).toBe(200);
    expect((await request(app).post(`/rates/previews/${preview.body.id}/commit`).send({})).status).toBe(200);
    expect((await client.db('rates').collection('publications').findOne({id:'paper'}))?.revision).toBe(1);
    const history=await request(app).get('/rates/paper/history?month=2026-10');
    expect(history.body.items).toHaveLength(31);
    expect(history.body.items[19]).toMatchObject({date:'2026-10-20',priceMinor:700,snapshots:[{priceMinor:600,invoiceId:'paid'}]});
  });
  it('rejects stale and expired previews',async()=>{
    expect((await request(app).post('/rates/paper/preview').send({revision:0,validFrom:'2026-10-16',price:900})).status).toBe(409);
    const preview=await request(app).post('/rates/paper/preview').send({revision:1,validFrom:'2026-10-21',price:900,replaceOverlaps:true});
    expect(preview.status).toBe(200);
    await client.db('rates').collection('ratePreviews').updateOne({id:preview.body.id},{$set:{expiresAt:new Date(0)}});
    expect((await request(app).post(`/rates/previews/${preview.body.id}/commit`).send({})).status).toBe(409);
  });
});
