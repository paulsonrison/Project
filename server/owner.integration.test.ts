import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { createApp } from './app.js';
import { createIndexes } from './db/connect.js';

describe('integration owner-operated delivery', () => {
  let mongo: MongoMemoryReplSet, client: MongoClient, app: ReturnType<typeof createApp>;
  const origin = 'http://localhost:5173';
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    client = await new MongoClient(mongo.getUri()).connect();
    const db = client.db('owner_test'); await createIndexes(db);
    app = createApp({ client, db, config: { mongoUri: mongo.getUri(), database: 'owner_test', origin, port: 3001, production: false, groqModel: 'test' } });
  }, 120000);
  afterAll(async () => { await client?.close(); await mongo?.stop(); });

  it('creates and bills a customer subscription without a delivery staff record', async () => {
    const owner = request.agent(app);
    expect((await owner.post('/api/v1/auth/register').set('Origin', origin).send({ name: 'Owner', society: 'Solo round', email: 'solo@example.test', password: 'solo-owner-password-123' })).status).toBe(201);
    const resident = (await owner.post('/api/v1/residents').set('Origin', origin).send({ name: 'Reader', unit: 'A-01' })).body;
    const publication = (await owner.post('/api/v1/publications').set('Origin', origin).send({ name: 'Daily', schedule: 'daily', basePrice: 600 })).body;
    const subscription = await owner.post('/api/v1/subscriptions').set('Origin', origin).send({ residentId: resident.id, publicationId: publication.id, startDate: '2026-01-01', endDate: '2026-01-02', quantity: 2 });
    expect(subscription.status).toBe(201);
    expect((await owner.get('/api/v1/staff')).body.items).toEqual([]);
    expect((await owner.post('/api/v1/deliveries/manifest').set('Origin', origin).send({ date: '2026-01-01' })).status).toBe(200);
    const delivery = (await owner.get('/api/v1/deliveries?date=2026-01-01')).body.items[0];
    expect(delivery.residentId).toBe(resident.id);
    expect((await owner.patch(`/api/v1/deliveries/${delivery.id}`).set('Origin', origin).send({ revision: delivery.revision, deliveredQuantity: 2, status: 'delivered' })).status).toBe(200);
    const bill = await owner.post('/api/v1/billing/runs').set('Origin', origin).set('Idempotency-Key', 'owner-january').send({ month: '2026-01' });
    expect(bill.status).toBe(201);
    expect(bill.body.items[0].totalMinor).toBe(1200);
  });

  it('still rejects a customer from another owner when no staff is assigned', async () => {
    const a = request.agent(app), b = request.agent(app);
    for (const [agent, key] of [[a, 'a'], [b, 'b']] as const) await agent.post('/api/v1/auth/register').set('Origin', origin).send({ name: key, society: key, email: `owner-${key}@example.test`, password: 'owner-isolation-password-123' });
    const foreignResident = (await b.post('/api/v1/residents').set('Origin', origin).send({ name: 'Foreign', unit: 'B-01' })).body;
    const paper = (await a.post('/api/v1/publications').set('Origin', origin).send({ name: 'Paper', schedule: 'daily', basePrice: 600 })).body;
    const response = await a.post('/api/v1/subscriptions').set('Origin', origin).send({ residentId: foreignResident.id, publicationId: paper.id, startDate: '2026-01-01' });
    expect(response.status).toBe(400);
    expect((await a.get('/api/v1/subscriptions')).body.items).toEqual([]);
  });
});
