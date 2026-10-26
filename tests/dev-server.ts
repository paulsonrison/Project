import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { createIndexes } from '../server/db/connect.js';
import { createApp } from '../server/app.js';
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const client = await new MongoClient(mongo.getUri()).connect();
const db = client.db('browser_tests'); await createIndexes(db);
const server = createApp({ client, db, config: { mongoUri: mongo.getUri(), database: 'browser_tests', origin: 'http://127.0.0.1:5173', port: 3001, production: false, groqModel: 'test' } }).listen(3001, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await client.close(); await mongo.stop(); process.exit(0); }));
