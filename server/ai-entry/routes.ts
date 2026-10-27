import { Router } from 'express';
import { createHash } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Dependencies } from '../app.js';
import { ApiError, requireRole } from '../auth/scope.js';
import { paperCode, type ImportRecord } from '../imports/workbook.js';
import { proposalInput, type PublicPayload } from './schemas.js';
import { buildPublicPayload, suggestSubscriptions } from './service.js';
import { resolveAiConfig } from '../preferences/service.js';

export const payloadHash = (payload: PublicPayload) => createHash('sha256').update(JSON.stringify(payload)).digest('hex');
export function aiEntryRoutes({ db, config }: Dependencies) {
  const router = Router();
  const limit = rateLimit({ windowMs: 60000, limit: 5, keyGenerator: (_req, res) => res.locals.scope.userId, standardHeaders: 'draft-8', legacyHeaders: false });
  router.use((_req, res, next) => { requireRole(res.locals.scope, 'admin'); next(); });
  const catalog = async (societyId: string) => (await db.collection<ImportRecord>('publications').find({ societyId, archived: { $ne: true } }, { projection: { id: 1, code: 1, name: 1 } }).limit(1000).toArray()).map(paper => ({ code: paperCode(paper), name: String(paper.name) }));
  router.post('/payload', async (req, res) => {
    const data = proposalInput.parse({ ...req.body, consentToGroq: true });
    const payload = buildPublicPayload(data, await catalog(res.locals.scope.societyId));
    res.json({ payload, hash: payloadHash(payload) });
  });
  router.post('/propose', limit, async (req, res) => {
    const envelope = z.object({ request: proposalInput, expectedPayloadHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(req.body);
    const papers = await catalog(res.locals.scope.societyId);
    const payload = buildPublicPayload(envelope.request, papers);
    if (payloadHash(payload) !== envelope.expectedPayloadHash) throw new ApiError(409, 'The newspaper choices changed. Review the public payload again.');
    const quotaId = `${res.locals.scope.societyId}:${res.locals.scope.userId}:${new Date().toISOString().slice(0, 10)}`;
    await db.collection<{ _id: string; count: number }>('aiEntryQuotas').updateOne({ _id: quotaId }, { $setOnInsert: { count: 0 } }, { upsert: true });
    const quota = await db.collection<{ _id: string; count: number }>('aiEntryQuotas').updateOne({ _id: quotaId, count: { $lt: 100 } }, { $inc: { count: 1 } });
    if (!quota.modifiedCount) throw new ApiError(429, 'Daily AI entry limit reached. Manual entry and Excel remain available.');
    res.json({ ...await suggestSubscriptions(await resolveAiConfig(db,config,res.locals.scope), envelope.request, papers), publicPayload: payload });
  });
  return router;
}
