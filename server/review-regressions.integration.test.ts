import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient, type CollectionOptions, type Document } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { operations } from './features/operations.js';
import { createPreview, commitPreview } from './imports/service.js';
import { ApiError } from './auth/scope.js';
import { createApp } from './app.js';

describe('integration independent review regressions', () => {
  let mongo: MongoMemoryReplSet, client: MongoClient;
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    client = await new MongoClient(mongo.getUri()).connect();
  }, 120000);
  afterAll(async () => { await client?.close(); await mongo?.stop(); });

  it('serializes a manual subscription creation against an import that already read its dependencies', async () => {
    const db = client.db('review-manual-import-race'), origin = 'http://localhost:5173';
    const app = createApp({ db, client, config: { mongoUri: mongo.getUri(), database: db.databaseName, origin, port: 3000, production: false, groqModel: 'test' } });
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').set('Origin', origin).send({ name: 'Owner', email: 'race@example.test', password: 'concurrent-password-123', society: 'Race' });
    const scope = (await agent.get('/api/v1/auth/session')).body;
    const resident = (await agent.post('/api/v1/residents').set('Origin', origin).send({ name: 'Anu', unit: '001' })).body;
    const paper = (await agent.post('/api/v1/publications').set('Origin', origin).send({ name: 'MM', code: 'MM', schedule: 'daily', basePrice: 600 })).body;
    await db.createCollection('subscriptions');
    const preview = await createPreview(db, scope, { entity: 'residents', mode: 'update', effectiveDate: '2090-01-01', rows: [{ 'Customer ID': resident.id, Revision: '0', 'Subscription: MM': '1' }] });
    expect(preview.errors).toEqual([]);
    let releaseRead!: () => void, signalRead!: () => void;
    const readReached = new Promise<void>(resolve => { signalRead = resolve; });
    const release = new Promise<void>(resolve => { releaseRead = resolve; });
    const originalCollection = db.collection.bind(db); let held = false;
    const spy = vi.spyOn(db, 'collection').mockImplementation(((name: string, options?: CollectionOptions) => {
      const collection = originalCollection<Document>(name, options), originalFind = collection.find.bind(collection);
      if (name === 'subscriptions') collection.find = ((filter: Document, findOptions?: Parameters<typeof originalFind>[1]) => {
        const cursor = originalFind(filter, findOptions);
        if (findOptions?.session && findOptions?.projection && !held) {
          held = true; const originalArray = cursor.toArray.bind(cursor);
          cursor.toArray = async () => { const items = await originalArray(); signalRead(); await release; return items; };
        }
        return cursor;
      }) as typeof collection.find;
      return collection;
    }) as typeof db.collection);
    try {
      const imported = commitPreview(db, client, scope, preview.id);
      await readReached;
      const manual = agent.post('/api/v1/subscriptions').set('Origin', origin).send({ residentId: resident.id, publicationId: paper.id, quantity: 2, startDate: '2090-01-01' }).then(response => response);
      // Give the manual request a chance to finish if it does not participate in the guard.
      await Promise.race([manual, new Promise<void>(resolve => setTimeout(resolve, 150))]);
      releaseRead();
      const [, response] = await Promise.all([imported, manual]);
      expect(response.status).toBe(409);
      expect(await originalCollection('subscriptions').countDocuments({ societyId: scope.societyId })).toBe(1);
    } finally { releaseRead(); spy.mockRestore(); }
  });

  it('updates an unchanged customer workbook using current subscriptions, not all historical periods', async () => {
    const db = client.db('review-current-subscriptions'), residentId = randomUUID(), publicationId = randomUUID();
    const scope = { societyId: 'review', userId: 'owner', role: 'admin' as const };
    await db.collection('residents').insertOne({ id: residentId, societyId: 'review', revision: 0, name: 'Anu', unit: '001' });
    await db.collection('publications').insertOne({ id: publicationId, societyId: 'review', revision: 0, name: 'MM', code: 'MM', schedule: 'daily', basePrice: 600 });
    await db.collection('subscriptions').insertMany([
      { id: randomUUID(), societyId: 'review', revision: 0, residentId, publicationId, quantity: 1, startDate: '2000-01-01', endDate: '2001-01-01' },
      { id: randomUUID(), societyId: 'review', revision: 0, residentId, publicationId, quantity: 2, startDate: '2001-01-01', endDate: '2090-01-01' },
      { id: randomUUID(), societyId: 'review', revision: 0, residentId, publicationId, quantity: 3, startDate: '2090-01-01' },
    ]);
    const preview = await createPreview(db, scope, { entity: 'residents', mode: 'update', rows: [{ 'Customer ID': residentId, Revision: '0', Name: 'Anu', 'Address/Flat': '001', 'Subscription: MM': '2' }] });
    expect(preview.errors).toEqual([]);
    expect(preview.changes.filter(change => change.collection === 'subscriptions')).toEqual([]);
    const changing = await createPreview(db, scope, { entity: 'residents', mode: 'update', rows: [{ 'Customer ID': residentId, Revision: '0', 'Subscription: MM': '1' }] });
    expect(changing.errors).toHaveLength(1);
    expect(changing.errors[0].message).toContain('Start Date');
  });

  it('replays existing billed snapshots without requiring rate coverage for their old dates', async () => {
    const db = client.db('review-snapshots'), residentId = randomUUID(), publicationId = randomUUID(), subscriptionId = randomUUID();
    await db.collection('residents').insertOne({ id: residentId, societyId: 'review', revision: 0, name: 'Anu', unit: '001' });
    await db.collection('publications').insertOne({ id: publicationId, societyId: 'review', revision: 1, name: 'MM', schedule: 'daily', basePrice: 600, pricingVersion: 2, rateIntervals: [{ id: randomUUID(), validFrom: '2026-11-01', price: 700 }] });
    await db.collection('subscriptions').insertOne({ id: subscriptionId, societyId: 'review', revision: 0, residentId, publicationId, quantity: 1, startDate: '2026-01-01', endDate: '2026-01-02' });
    await db.collection('deliveries').insertOne({ id: randomUUID(), societyId: 'review', revision: 0, subscriptionId, residentId, publicationId, date: '2026-01-01', status: 'delivered', priceMinor: 600, deliveredQuantity: 1, billableQuantity: 1, invoiceId: 'original-invoice' });
    const app = express(); app.use(express.json()); app.use((_req, res, next) => { res.locals.scope = { societyId: 'review', userId: 'owner', role: 'admin' }; next(); });
    app.use(operations({ db, client, config: { mongoUri: mongo.getUri(), database: db.databaseName, origin: 'http://localhost', port: 3000, production: false, groqModel: 'test' } }));
    app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => { void next; res.status(error instanceof ApiError ? error.status : 500).json({ message: error instanceof Error ? error.message : 'error' }); });
    const response = await request(app).post('/deliveries/manifest').send({ date: '2026-01-01' });
    expect(response.status).toBe(200);
    expect(await db.collection('deliveries').findOne({ subscriptionId })).toMatchObject({ priceMinor: 600, invoiceId: 'original-invoice', status: 'delivered', revision: 0 });
  });

  it('does not require an unknown rate for a paused nonbillable service date', async () => {
    const db = client.db('review-paused-rates'), residentId = randomUUID(), publicationId = randomUUID(), subscriptionId = randomUUID();
    await db.collection('residents').insertOne({ id: residentId, societyId: 'review', revision: 0, name: 'Anu', unit: '001' });
    await db.collection('publications').insertOne({ id: publicationId, societyId: 'review', revision: 1, name: 'MM', schedule: 'daily', basePrice: 600, pricingVersion: 2, rateIntervals: [] });
    await db.collection('subscriptions').insertOne({ id: subscriptionId, societyId: 'review', revision: 0, residentId, publicationId, quantity: 1, startDate: '2026-01-01', endDate: '2026-01-02' });
    await db.collection('pauses').insertOne({ id: randomUUID(), societyId: 'review', residentId, startDate: '2026-01-01', endDate: '2026-01-02' });
    const app = express(); app.use(express.json()); app.use((_req, res, next) => { res.locals.scope = { societyId: 'review', userId: 'owner', role: 'admin' }; next(); });
    app.use(operations({ db, client, config: { mongoUri: mongo.getUri(), database: db.databaseName, origin: 'http://localhost', port: 3000, production: false, groqModel: 'test' } }));
    const response = await request(app).post('/deliveries/manifest').send({ date: '2026-01-01' });
    expect(response.status).toBe(200);
    expect(await db.collection('deliveries').findOne({ subscriptionId })).toMatchObject({ status: 'paused', priceMinor: 0, billableQuantity: 0 });
  });
});
