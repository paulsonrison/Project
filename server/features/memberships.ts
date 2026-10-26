import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Db } from 'mongodb';
import type { AccessScope } from '../../shared/contracts.js';
import { ApiError, requireRole } from '../auth/scope.js';
import { tokenHash } from '../auth/routes.js';
export function memberships(db: Db) {
  const router = Router();
  router.post('/invitations', async (req, res) => {
    const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
    const data = z.object({ email: z.email().transform(e => e.toLowerCase()), role: z.enum(['resident', 'staff']), residentId: z.string().uuid().optional(), staffId: z.string().uuid().optional() }).parse(req.body);
    const link = data.role === 'resident' ? data.residentId : data.staffId;
    if (!link || !await db.collection(data.role === 'resident' ? 'residents' : 'staff').findOne({ societyId: scope.societyId, id: link, archived: { $ne: true } })) throw new ApiError(400, 'Select a valid linked account');
    const token = randomBytes(32).toString('hex');
    await db.collection('invitations').insertOne({ ...data, societyId: scope.societyId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 2 * 86400000) });
    res.status(201).json({ token, expiresInHours: 48 });
  });
  router.delete('/memberships/:linkedId', async (req, res) => {
    const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
    const filter = { societyId: scope.societyId, role: { $ne: 'admin' }, $or: [{ residentId: req.params.linkedId }, { staffId: req.params.linkedId }] };
    await db.collection('memberships').deleteMany(filter); res.sendStatus(204);
  });
  return router;
}
