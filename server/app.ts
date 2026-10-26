import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import type { Db, MongoClient } from 'mongodb';
import type { AccessScope } from '../shared/contracts.js';
import type { Config } from './config/env.js';
import { authRoutes, tokenHash } from './auth/routes.js';
import { ApiError, requireRole, visibleFilter } from './auth/scope.js';
import { schemas, validRange, type Resource } from './features/schemas.js';
import type { Entity } from './db/connect.js';
import { operations } from './features/operations.js';
import { memberships } from './features/memberships.js';
import { chatRoutes } from './chat/routes.js';
import { complaintRoutes } from './features/complaints.js';

export interface Dependencies { db: Db; client: MongoClient; config: Config }
export function createApp({ db, client, config }: Dependencies) {
  const app = express();
  async function validateReferences(data: Record<string, unknown>, scope: AccessScope) {
    const refs = { residentId: 'residents', publicationId: 'publications', staffId: 'staff', subscriptionId: 'subscriptions', deliveryId: 'deliveries' };
    for (const [key, collection] of Object.entries(refs)) {
      const reference = data[key];
      if (reference && !await db.collection(collection).findOne({ id: reference, societyId: scope.societyId, archived: { $ne: true } })) throw new ApiError(400, `Invalid ${key}`);
    }
  }
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { 'font-src': ["'self'", 'https://fonts.gstatic.com'], 'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'] } } }));
  app.use(express.json({ limit: '32kb' })); app.use(cookieParser());
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.path.startsWith('/api/') && req.get('origin') !== new URL(config.origin).origin) return next(new ApiError(403, 'Request origin rejected'));
    next();
  });
  app.get('/api/health', async (_req, res) => { await db.command({ ping: 1 }); res.json({ status: 'ready' }); });
  app.use('/api/v1/auth', authRoutes(db, client, config));
  app.use('/api/v1', async (req, res, next) => {
    const token = req.cookies?.presstrack_session;
    const session = token && await db.collection('sessions').findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
    if (!session) throw new ApiError(401, 'Sign in to continue');
    const member = await db.collection('memberships').findOne({ userId: session.userId, societyId: session.societyId });
    if (!member) throw new ApiError(401, 'Membership is no longer active');
    res.locals.scope = { userId: member.userId, societyId: member.societyId, role: member.role, residentId: member.residentId, staffId: member.staffId } satisfies AccessScope;
    next();
  });
  app.get('/api/v1/auth/session', async (_req, res) => {
    const scope: AccessScope = res.locals.scope;
    const user = await db.collection('users').findOne({ id: scope.userId }, { projection: { _id: 0, name: 1, email: 1 } });
    const society = await db.collection('societies').findOne({ id: scope.societyId }, { projection: { _id: 0 } });
    res.json({ ...scope, ...user, society });
  });
  for (const resource of Object.keys(schemas) as Resource[]) {
    app.get(`/api/v1/${resource}`, async (req, res) => {
      const scope: AccessScope = res.locals.scope;
      const offset = Math.max(0, Math.min(100000, Number(req.query.offset) || 0));
      const filter = { ...visibleFilter(scope, resource), archived: { $ne: true } };
      const items = await db.collection(resource).find(filter, { projection: { _id: 0 } }).sort({ name: 1, startDate: -1 }).skip(offset).limit(100).toArray();
      res.json({ items, offset, total: await db.collection(resource).countDocuments(filter) });
    });
    app.post(`/api/v1/${resource}`, async (req, res) => {
      const scope: AccessScope = res.locals.scope;
      if (['pauses', 'complaints'].includes(resource)) requireRole(scope, 'admin', 'resident'); else requireRole(scope, 'admin');
      const data = schemas[resource].parse(req.body);
      if ('startDate' in data) validRange(data);
      if (scope.role === 'resident' && 'residentId' in data && data.residentId !== scope.residentId) throw new ApiError(403, 'Forbidden');
      await validateReferences(data, scope);
      if (resource === 'pauses' && 'residentId' in data && 'subscriptionId' in data && data.subscriptionId) {
        if (!await db.collection('subscriptions').findOne({ societyId: scope.societyId, id: data.subscriptionId, residentId: data.residentId })) throw new ApiError(400, 'Pause subscription does not belong to this resident');
      }
      if (resource === 'complaints' && 'deliveryId' in data && 'residentId' in data) {
        if (!await db.collection('deliveries').findOne({ societyId: scope.societyId, id: data.deliveryId, residentId: data.residentId })) throw new ApiError(400, 'Delivery does not belong to this resident');
      }
      if (resource === 'subscriptions' && 'residentId' in data && 'publicationId' in data) {
        const overlapping = await db.collection('subscriptions').find({ societyId: scope.societyId, residentId: data.residentId, publicationId: data.publicationId, archived: { $ne: true } }).toArray();
        if (overlapping.some(s => ('endDate' in data ? data.endDate ?? '9999-12-31' : '9999-12-31') > s.startDate && (s.endDate ?? '9999-12-31') > ('startDate' in data ? data.startDate : ''))) throw new ApiError(409, 'An overlapping subscription already exists');
      }
      if (resource === 'pauses' && 'startDate' in data) {
        const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).format(new Date());
        const today = local.slice(0, 10), hour = Number(local.slice(11, 13));
        const earliest = new Date(`${today}T12:00:00Z`); earliest.setUTCDate(earliest.getUTCDate() + (hour >= 18 ? 2 : 1));
        if (data.startDate < earliest.toISOString().slice(0, 10)) throw new ApiError(400, `Pause requests must start on or after ${earliest.toISOString().slice(0, 10)} (18:00 cutoff)`);
      }
      const entity = { ...data, id: randomUUID(), societyId: scope.societyId, revision: 0, createdAt: new Date().toISOString() };
      await db.collection(resource).insertOne(entity);
      res.status(201).json(entity);
    });
    app.patch(`/api/v1/${resource}/:id`, async (req, res) => {
      const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
      const existing = await db.collection<Entity>(resource).findOne({ id: req.params.id, societyId: scope.societyId });
      if (!existing) throw new ApiError(404, 'Record not found');
      const revision = Number(req.body.revision);
      if (!Number.isInteger(revision) || revision !== existing.revision) throw new ApiError(409, 'This record changed. Refresh and retry.');
      const data = schemas[resource].parse({ ...existing, ...req.body });
      if ('startDate' in data) validRange(data);
      await validateReferences(data, scope);
      if (resource === 'subscriptions') {
        const deliveries = await db.collection('deliveries').countDocuments({ societyId: scope.societyId, subscriptionId: existing.id });
        if (deliveries && ['residentId', 'publicationId', 'quantity', 'startDate'].some(key => key in req.body && req.body[key] !== existing[key])) throw new ApiError(409, 'This subscription has delivery history. Set a future stop date and add a replacement subscription to change its paper, quantity or resident.');
        if ('endDate' in data && data.endDate && await db.collection('deliveries').findOne({ societyId: scope.societyId, subscriptionId: existing.id, date: { $gte: data.endDate }, invoiceId: { $exists: true } })) throw new ApiError(409, 'Stop date cannot remove billed deliveries');
      }
      if (resource === 'publications' && 'basePrice' in data && data.basePrice !== existing.basePrice) {
        if (!data.effectiveDate) throw new ApiError(400, 'Specify an effective date for a price change');
        const latestBilled = await db.collection('deliveries').findOne({ societyId: scope.societyId, publicationId: existing.id, invoiceId: { $exists: true }, date: { $gte: data.effectiveDate } });
        if (latestBilled) throw new ApiError(409, 'Price changes cannot rewrite billed delivery dates');
        data.priceHistory = [...(existing.priceHistory ?? []), { effectiveDate: data.effectiveDate, price: data.basePrice }]; data.basePrice = existing.basePrice;
      }
      const result = await db.collection<Entity>(resource).findOneAndUpdate({ id: existing.id, societyId: scope.societyId, revision }, { $set: data, $inc: { revision: 1 } }, { returnDocument: 'after', projection: { _id: 0 } });
      if (!result) throw new ApiError(409, 'This record changed. Refresh and retry.');
      res.json(result);
    });
    app.delete(`/api/v1/${resource}/:id`, async (req, res) => {
      const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
      const result = await db.collection(resource).updateOne({ id: req.params.id, societyId: scope.societyId }, { $set: { archived: true, archivedDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) }, $inc: { revision: 1 } });
      if (!result.matchedCount) throw new ApiError(404, 'Record not found');
      res.sendStatus(204);
    });
  }
  app.use('/api/v1', operations({ db, client, config }));
  app.use('/api/v1', memberships(db));
  app.use('/api/v1', complaintRoutes({ db, client, config }));
  app.use('/api/v1/chat', chatRoutes({ db, client, config }));
  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'Endpoint not found')));
  if (config.production) {
    app.use(express.static(resolve('dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
  }
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    const duplicate = typeof err === 'object' && err && 'code' in err && err.code === 11000;
    const status = err instanceof ApiError ? err.status : err instanceof ZodError ? 400 : duplicate ? 409 : 500;
    const message = err instanceof ApiError ? err.message : err instanceof ZodError ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : duplicate ? 'This record already exists' : 'Unable to complete request';
    if (status === 500) console.error('Request failed', res.locals.requestId, err instanceof Error ? err.name : 'UnknownError');
    res.status(status).json({ error: { code: String(status), message, requestId: res.locals.requestId } });
  });
  return app;
}
