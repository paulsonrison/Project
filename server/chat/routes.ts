import { Router } from 'express';
import { randomUUID, createHash } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { AccessScope } from '../../shared/contracts.js';
import type { Dependencies } from '../app.js';
import { ApiError } from '../auth/scope.js';
import { answerMessage } from './service.js';
import { resolveAiConfig } from '../preferences/service.js';
export function chatRoutes({ db, config }: Dependencies) {
  const router = Router();
  const limit = rateLimit({ windowMs: 60000, limit: 10, keyGenerator: (_req, res) => res.locals.scope.userId, standardHeaders: 'draft-8', legacyHeaders: false });
  const filter = (scope: AccessScope) => ({ societyId: scope.societyId, userId: scope.userId });
  async function accessKey(scope: AccessScope) {
    const assignments = scope.role === 'staff' ? await db.collection('subscriptions').find({ societyId: scope.societyId, staffId: scope.staffId, archived: { $ne: true } }, { projection: { _id: 0, id: 1, revision: 1 } }).sort({ id: 1 }).toArray() : [];
    return createHash('sha256').update(JSON.stringify({ ...scope, assignments })).digest('hex');
  }
  router.get('/threads', async (_req, res) => res.json({ items: await db.collection('chatThreads').find(filter(res.locals.scope), { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(50).toArray() }));
  router.post('/threads', async (_req, res) => {
    const thread = { id: randomUUID(), ...filter(res.locals.scope), accessKey: await accessKey(res.locals.scope), createdAt: new Date().toISOString() };
    await db.collection('chatThreads').insertOne(thread); res.status(201).json(thread);
  });
  router.get('/threads/:id', async (req, res) => {
    const owned = { ...filter(res.locals.scope), id: req.params.id };
    if (!await db.collection('chatThreads').findOne(owned)) throw new ApiError(404, 'Conversation not found');
    if (!await db.collection('chatThreads').findOne({ ...owned, accessKey: await accessKey(res.locals.scope) })) throw new ApiError(409, 'Your permissions changed. Start a new conversation.');
    res.json({ items: await db.collection('chatMessages').find({ ...filter(res.locals.scope), threadId: req.params.id }, { projection: { _id: 0 } }).sort({ at: 1 }).limit(100).toArray() });
  });
  router.delete('/threads/:id', async (req, res) => {
    const owned = { ...filter(res.locals.scope), id: req.params.id };
    if (!(await db.collection('chatThreads').deleteOne(owned)).deletedCount) throw new ApiError(404, 'Conversation not found');
    await db.collection('chatMessages').deleteMany({ ...filter(res.locals.scope), threadId: req.params.id }); res.sendStatus(204);
  });
  router.post('/messages', limit, async (req, res) => {
    const scope: AccessScope = res.locals.scope;
    const data = z.object({ threadId: z.string().uuid(), text: z.string().trim().min(1).max(4000),locale:z.enum(['en-IN','hi-IN','ml-IN']).default('en-IN') }).parse(req.body);
    if (!await db.collection('chatThreads').findOne({ ...filter(scope), id: data.threadId })) throw new ApiError(404, 'Conversation not found');
    if (!await db.collection('chatThreads').findOne({ ...filter(scope), id: data.threadId, accessKey: await accessKey(scope) })) throw new ApiError(409, 'Your permissions changed. Start a new conversation.');
    const recent = await db.collection('chatMessages').find({ ...filter(scope), threadId: data.threadId }).sort({ at: -1 }).limit(12).toArray();
    const history = recent.reverse().filter(m => m.role === 'user').map(m => ({ role: 'user', content: String(m.text).slice(0, 4000) }));
    const day = new Date().toISOString().slice(0, 10);
    await db.collection('chatQuotas').updateOne({ societyId: scope.societyId, day }, { $setOnInsert: { count: 0 } }, { upsert: true });
    const quota = await db.collection('chatQuotas').updateOne({ societyId: scope.societyId, day, count: { $lt: 1000 } }, { $inc: { count: 1 } });
    if (!quota.modifiedCount) throw new ApiError(429, 'Your society has reached its daily assistant limit');
    let answer;
    try { answer = await answerMessage(db, await resolveAiConfig(db,config,scope), scope, data.text, history,data.locale); }
    catch (err) { if (err instanceof ApiError) throw err; throw new ApiError(503, 'The assistant could not complete this request. Please retry.'); }
    const expiresAt = new Date(Date.now() + 30 * 86400000), at = new Date();
    await db.collection('chatMessages').insertMany([{ id: randomUUID(), ...filter(scope), threadId: data.threadId, text: data.text, role: 'user', at, expiresAt }, { id: randomUUID(), ...filter(scope), threadId: data.threadId, ...answer, role: 'assistant', at: new Date(at.getTime() + 1), expiresAt }]);
    res.json(answer);
  });
  return router;
}
