import { MongoClient, type Db, type Document } from 'mongodb';
import type { Config } from '../config/env.js';
export interface Entity extends Document { id: string; societyId: string; revision: number }
export async function createIndexes(db: Db) {
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('memberships').createIndex({ userId: 1, societyId: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('invitations').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('deliveries').createIndex({ societyId: 1, subscriptionId: 1, date: 1 }, { unique: true });
  await db.collection('invoices').createIndex({ societyId: 1, residentId: 1, month: 1 }, { unique: true });
  for (const name of ['residents', 'publications', 'staff', 'subscriptions', 'pauses', 'deliveries', 'invoices', 'payments', 'adjustments', 'complaints', 'chatThreads']) {
    await db.collection(name).createIndex({ societyId: 1, id: 1 }, { unique: true });
  }
  await db.collection('chatMessages').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('idempotency').createIndex({ societyId: 1, key: 1 }, { unique: true });
  await db.collection('chatQuotas').createIndex({ societyId: 1, day: 1 }, { unique: true });
  await db.collection('paymentAllocations').createIndex({ societyId: 1, invoiceId: 1, paymentId: 1 });
}
export async function connect(config: Config) {
  const client = await new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 10000 }).connect();
  const db = client.db(config.database);
  await createIndexes(db);
  return { client, db };
}
