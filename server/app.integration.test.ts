import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { createApp } from './app.js';

describe('integration account and society isolation', () => {
  let mongo: MongoMemoryReplSet, client: MongoClient;
  let app: ReturnType<typeof createApp>;
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    client = await new MongoClient(mongo.getUri()).connect();
    app = createApp({ client, db: client.db('test'), config: { mongoUri: mongo.getUri(), database: 'test', origin: 'http://localhost:5173', port: 3001, production: false, groqModel: 'test' } });
  }, 120000);
  afterAll(async () => { await client?.close(); await mongo?.stop(); });
  it('integration rejects anonymous and cross-origin mutations', async () => {
    expect((await request(app).get('/api/v1/residents')).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').set('Origin', 'https://evil.test').send({})).status).toBe(403);
  });
  it('integration scopes persisted CRUD to independently registered societies', async () => {
    const a = request.agent(app), b = request.agent(app);
    const origin = 'http://localhost:5173';
    const first = await a.post('/api/v1/auth/register').set('Origin', origin).send({ email: 'a@example.test', password: 'a-long-test-password-1', name: 'Admin A', society: 'Society A' });
    expect(first.status).toBe(201);
    expect((await b.post('/api/v1/auth/register').set('Origin', origin).send({ email: 'b@example.test', password: 'a-long-test-password-2', name: 'Admin B', society: 'Society B' })).status).toBe(201);
    const resident = await a.post('/api/v1/residents').set('Origin', origin).send({ name: 'Private A', unit: '101', phone: '', address: '' });
    expect(resident.status).toBe(201);
    expect((await b.get('/api/v1/residents')).body.items).toEqual([]);
    expect((await b.patch(`/api/v1/residents/${resident.body.id}`).set('Origin', origin).send({ name: 'Intruder', revision: 0 })).status).toBe(404);
    expect((await a.get('/api/v1/residents')).body.items[0].name).toBe('Private A');
    expect((await a.post('/api/v1/auth/logout').set('Origin', origin)).status).toBe(204);
    expect((await a.get('/api/v1/residents')).status).toBe(401);
  });
});
