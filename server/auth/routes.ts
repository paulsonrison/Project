import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { hashPassword, verifyPassword } from './passwords.js';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Db, MongoClient } from 'mongodb';
import type { Config } from '../config/env.js';
import { ApiError } from './scope.js';
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function authRoutes(db: Db, client: MongoClient, config: Config) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
  const credentials = z.object({ email: z.email().transform(v => v.toLowerCase()), password: z.string().min(12).max(128) });
  async function session(res: Response, userId: string, societyId: string) {
    const token = randomBytes(32).toString('hex');
    await db.collection('sessions').insertOne({ tokenHash: tokenHash(token), userId, societyId, expiresAt: new Date(Date.now() + 7 * 86400000) });
    res.cookie('presstrack_session', token, { httpOnly: true, secure: config.production, sameSite: 'lax', maxAge: 7 * 86400000, path: '/' });
  }
  router.post('/register', limiter, async (req, res) => {
    const data = credentials.extend({ name: z.string().trim().min(1).max(100), society: z.string().trim().min(1).max(100) }).parse(req.body);
    const userId = randomUUID(), societyId = randomUUID(), passwordHash = await hashPassword(data.password);
    const tx = client.startSession();
    try {
      await tx.withTransaction(async () => {
        await db.collection('users').insertOne({ id: userId, email: data.email, name: data.name, passwordHash }, { session: tx });
        await db.collection('societies').insertOne({ id: societyId, name: data.society, timezone: 'Asia/Kolkata', currency: 'INR', pauseCutoffHour: 18, revision: 0 }, { session: tx });
        await db.collection('memberships').insertOne({ userId, societyId, role: 'admin' }, { session: tx });
      });
      await session(res, userId, societyId); res.status(201).json({ ok: true });
    } finally { await tx.endSession(); }
  });
  router.post('/login', limiter, async (req, res) => {
    const data = credentials.parse(req.body);
    const user = await db.collection('users').findOne({ email: data.email });
    if (!user || !await verifyPassword(user.passwordHash, data.password)) throw new ApiError(401, 'Email or password is incorrect');
    const member = await db.collection('memberships').findOne({ userId: user.id });
    if (!member) throw new ApiError(403, 'No active membership');
    await session(res, user.id, member.societyId); res.json({ ok: true });
  });
  router.post('/logout', async (req: Request, res: Response) => {
    const token = req.cookies?.presstrack_session;
    if (token) await db.collection('sessions').deleteOne({ tokenHash: tokenHash(token) });
    res.clearCookie('presstrack_session', { path: '/' }); res.sendStatus(204);
  });
  return router;
}
