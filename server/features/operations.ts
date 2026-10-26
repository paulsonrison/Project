import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AccessScope, Publication, DateRange } from '../../shared/contracts.js';
import type { Dependencies } from '../app.js';
import type { Entity } from '../db/connect.js';
import { ApiError, requireRole, visibleFilter } from '../auth/scope.js';
import { date, month } from './schemas.js';
import { getServiceDates, resolvePrice, invoiceTotal } from '../domain/rules.js';
import { ledgerSnapshot } from '../domain/ledger.js';
import { deliveryFilter } from '../auth/deliveryFilter.js';

export function operations({ db, client }: Dependencies) {
  const router = Router();
  const collection = (name: string) => db.collection<Entity>(name);
  async function reconcile(scope: AccessScope, ym: string) {
    const subscriptions = await collection('subscriptions').find({ societyId: scope.societyId }).toArray();
    for (const sub of subscriptions) {
      const paper = await collection('publications').findOne({ id: sub.publicationId, societyId: scope.societyId });
      const resident = await collection('residents').findOne({ id: sub.residentId, societyId: scope.societyId });
      if (!paper || !resident) throw new ApiError(409, 'A subscription has missing records');
      const pauses = await collection('pauses').find({ societyId: scope.societyId, residentId: sub.residentId, archived: { $ne: true }, $or: [{ subscriptionId: sub.id }, { subscriptionId: { $exists: false } }] }).toArray();
      const dates = getServiceDates(paper as unknown as Publication, sub as unknown as DateRange, [], ym);
      const future = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      await collection('deliveries').updateMany({ societyId: scope.societyId, subscriptionId: sub.id, invoiceId: { $exists: false }, date: { $gte: `${ym}-01`, $lt: `${ym}-32`, $nin: dates }, status: { $in: ['pending', 'paused'] } }, { $set: { status: 'publication-cancelled', cancellationReason: 'subscription-ineligible', billableQuantity: 0 }, $inc: { revision: 1 } });
      for (const serviceDate of dates) {
        const paused = pauses.some(p => serviceDate >= p.startDate && serviceDate < p.endDate) || (sub.archived && serviceDate >= sub.archivedDate) || (paper.archived && serviceDate >= paper.archivedDate) || (resident.archived && serviceDate >= resident.archivedDate);
        await collection('deliveries').updateOne({ societyId: scope.societyId, subscriptionId: sub.id, date: serviceDate }, { $setOnInsert: {
          id: randomUUID(), societyId: scope.societyId, subscriptionId: sub.id, residentId: sub.residentId,
          staffId: sub.staffId, publicationId: sub.publicationId, publicationName: paper.name,
          residentName: resident.name, unit: resident.unit, address: resident.address, instructions: resident.instructions,
          routeOrder: sub.routeOrder, date: serviceDate, status: paused ? 'paused' : 'pending',
          orderedQuantity: sub.quantity, deliveredQuantity: 0, billableQuantity: 0, revision: 0,
          priceMinor: resolvePrice(paper as unknown as Publication, serviceDate),
        } }, { upsert: true });
        if (serviceDate >= future) await collection('deliveries').updateOne({ societyId: scope.societyId, subscriptionId: sub.id, date: serviceDate, invoiceId: { $exists: false }, $or: [{ status: { $in: ['pending', 'paused'] } }, { status: 'publication-cancelled', cancellationReason: 'subscription-ineligible' }] }, { $set: { status: paused ? 'paused' : 'pending', staffId: sub.staffId, orderedQuantity: sub.quantity, priceMinor: resolvePrice(paper as unknown as Publication, serviceDate) }, $unset: { cancellationReason: '' }, $inc: { revision: 1 } });
      }
    }
  }
  router.post('/deliveries/manifest', async (req, res) => {
    const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
    const value = date.parse(req.body.date); await reconcile(scope, value.slice(0, 7));
    res.json({ ok: true });
  });
  router.get('/deliveries', async (req, res) => {
    const scope: AccessScope = res.locals.scope;
    const filter: Record<string, unknown> = await deliveryFilter(db, scope);
    if (req.query.date) filter.date = date.parse(req.query.date);
    if (req.query.month) { const ym = month.parse(req.query.month); filter.date = { $gte: `${ym}-01`, $lt: `${ym}-32` }; }
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const items = await collection('deliveries').find(filter, { projection: { _id: 0 } }).sort({ date: 1, routeOrder: 1 }).skip(offset).limit(100).toArray();
    res.json({ items, total: await collection('deliveries').countDocuments(filter), offset });
  });
  router.patch('/deliveries/:id', async (req, res) => {
    const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin', 'staff');
    const data = z.object({ revision: z.number().int(), deliveredQuantity: z.number().int().min(0).max(100), status: z.enum(['delivered', 'partial', 'missed', 'publication-cancelled']), reason: z.string().max(200).default('') }).parse(req.body);
    const job = await collection('deliveries').findOne({ ...await deliveryFilter(db, scope), id: req.params.id });
    if (!job) throw new ApiError(404, 'Delivery not found');
    if (job.invoiceId || job.status === 'paused' || job.complaintResolved) throw new ApiError(409, 'Billed, paused or reviewed delivery cannot be changed');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (job.date > today) throw new ApiError(409, 'Future deliveries cannot be confirmed early');
    const subscription = await collection('subscriptions').findOne({ societyId: scope.societyId, id: job.subscriptionId });
    if (!subscription || (subscription.archived && job.date >= subscription.archivedDate) || (subscription.endDate && job.date >= subscription.endDate)) throw new ApiError(409, 'Subscription is not active for this service date');
    const activePause = await collection('pauses').findOne({ societyId: scope.societyId, residentId: job.residentId, archived: { $ne: true }, startDate: { $lte: job.date }, endDate: { $gt: job.date }, $or: [{ subscriptionId: job.subscriptionId }, { subscriptionId: { $exists: false } }] });
    if (activePause) throw new ApiError(409, 'This delivery date is paused');
    if (data.deliveredQuantity > job.orderedQuantity || data.deliveredQuantity < job.deliveredQuantity) throw new ApiError(400, 'Delivered count must increase within ordered quantity');
    if ((data.status === 'delivered' && data.deliveredQuantity !== job.orderedQuantity) || (data.status === 'partial' && (data.deliveredQuantity === 0 || data.deliveredQuantity === job.orderedQuantity)) || (['missed', 'publication-cancelled'].includes(data.status) && data.deliveredQuantity !== 0)) throw new ApiError(400, 'Outcome does not match delivered quantity');
    const tx = client.startSession(); let updated;
    try { await tx.withTransaction(async () => {
      updated = await collection('deliveries').findOneAndUpdate({ id: job.id, societyId: scope.societyId, revision: data.revision, invoiceId: { $exists: false }, complaintResolved: { $ne: true } }, { $set: { status: data.status, deliveredQuantity: data.deliveredQuantity, billableQuantity: data.deliveredQuantity }, $inc: { revision: 1 } }, { session: tx, returnDocument: 'after', projection: { _id: 0 } });
      if (!updated) throw new ApiError(409, 'Delivery changed. Refresh and retry.');
      await db.collection('deliveryEvents').insertOne({ id: randomUUID(), societyId: scope.societyId, deliveryId: job.id, userId: scope.userId, ...data, at: new Date() }, { session: tx });
    }); } finally { await tx.endSession(); }
    res.json(updated);
  });
  router.post('/billing/runs', async (req, res) => {
    const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
    const ym = month.parse(req.body.month), key = z.string().min(8).max(100).parse(req.get('Idempotency-Key'));
    const previous = await db.collection('idempotency').findOne({ societyId: scope.societyId, key });
    if (previous) { if (previous.operation !== `bill:${ym}`) throw new ApiError(409, 'Idempotency key reused for different request'); return res.json({ items: previous.items }); }
    await reconcile(scope, ym);
    const session = client.startSession(); const items: Entity[] = [];
    try { await session.withTransaction(async () => {
      items.length = 0;
      const jobs = await collection('deliveries').find({ societyId: scope.societyId, date: { $gte: `${ym}-01`, $lt: `${ym}-32` } }, { session }).toArray();
      if (jobs.some(j => j.status === 'pending')) throw new ApiError(409, 'Unresolved deliveries. Record outcomes for every date first.');
      for (const residentId of new Set(jobs.map(j => j.residentId))) {
        const existing = await collection('invoices').findOne({ societyId: scope.societyId, residentId, month: ym }, { session });
        if (existing) { items.push(existing); continue; }
        const rows = jobs.filter(j => j.residentId === residentId);
        const lines = rows.map(j => ({ deliveryId: j.id, date: j.date, publicationName: j.publicationName, quantity: j.billableQuantity, priceMinor: j.priceMinor, amountMinor: j.billableQuantity * j.priceMinor }));
        const invoice: Entity = { id: randomUUID(), societyId: scope.societyId, revision: 0, residentId, residentName: rows[0].residentName, month: ym, lines, totalMinor: invoiceTotal(rows.map(j => ({ status: j.status, deliveredQuantity: j.deliveredQuantity, billableQuantity: j.billableQuantity, priceMinor: j.priceMinor }))), status: 'draft', currency: 'INR', createdAt: new Date().toISOString() };
        await collection('invoices').insertOne(invoice, { session });
        await collection('deliveries').updateMany({ societyId: scope.societyId, id: { $in: rows.map(j => j.id) } }, { $set: { invoiceId: invoice.id }, $inc: { revision: 1 } }, { session });
        items.push(invoice);
      }
      await db.collection('idempotency').insertOne({ societyId: scope.societyId, key, operation: `bill:${ym}`, items }, { session });
    }); } finally { await session.endSession(); }
    res.status(201).json({ items });
  });
  for (const resource of ['invoices', 'payments', 'adjustments']) router.get(`/${resource}`, async (req, res) => {
    const scope: AccessScope = res.locals.scope;
    const filter: Record<string, unknown> = visibleFilter(scope, resource);
    if (resource === 'invoices' && req.query.month) filter.month = month.parse(req.query.month);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const items = await collection(resource).find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1, id: 1 }).skip(offset).limit(100).toArray();
    if (resource === 'invoices') for (const invoice of items) {
      Object.assign(invoice, await ledgerSnapshot(db, invoice));
    }
    res.json({ items, total: await collection(resource).countDocuments(filter) });
  });
  router.post('/invoices/:id/issue', async (req, res) => {
    const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
    const invoice = await collection('invoices').findOneAndUpdate({ societyId: scope.societyId, id: req.params.id, status: 'draft' }, { $set: { status: 'issued', issuedAt: new Date().toISOString() }, $inc: { revision: 1 } }, { returnDocument: 'after', projection: { _id: 0 } });
    if (!invoice) throw new ApiError(409, 'Invoice missing or already issued'); res.json(invoice);
  });
  router.post('/invoices/:id/apply-credit', async (req, res) => {
    const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
    const session = client.startSession();
    try { await session.withTransaction(async () => {
      const invoice = await collection('invoices').findOneAndUpdate({ societyId: scope.societyId, id: req.params.id, status: 'issued' }, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
      if (!invoice) throw new ApiError(404, 'Issued invoice not found');
      let due = (await ledgerSnapshot(db, invoice, session)).dueMinor;
      const payments = await collection('payments').find({ societyId: scope.societyId, invoiceId: invoice.id, amountMinor: { $gt: 0 } }, { session }).toArray();
      for (const payment of payments) {
        if (!due) break;
        if (await collection('payments').findOne({ societyId: scope.societyId, reversalOf: payment.id }, { session })) continue;
        const rows = await db.collection('paymentAllocations').find({ societyId: scope.societyId, invoiceId: invoice.id, paymentId: payment.id }, { session }).toArray();
        const available = payment.amountMinor - rows.reduce((s, r) => s + r.amountMinor, 0), amount = Math.min(due, available);
        if (amount > 0) { await db.collection('paymentAllocations').insertOne({ id: randomUUID(), societyId: scope.societyId, invoiceId: invoice.id, paymentId: payment.id, amountMinor: amount, userId: scope.userId, explicit: true, createdAt: new Date() }, { session }); due -= amount; }
      }
    }); } finally { await session.endSession(); }
    res.json({ ok: true });
  });
  for (const resource of ['payments', 'adjustments']) router.post(`/${resource}`, async (req, res) => {
    const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
    const data = z.object({ invoiceId: z.string().uuid(), amountMinor: z.number().int().min(1).max(100000000), reference: z.string().trim().min(1).max(200) }).parse(req.body);
    const key = z.string().min(8).max(100).parse(req.get('Idempotency-Key'));
    const operation = JSON.stringify({ resource, ...data });
    const session = client.startSession(); let entity;
    try { await session.withTransaction(async () => {
      const previous = await db.collection('idempotency').findOne({ societyId: scope.societyId, key }, { session });
      if (previous) { if (previous.operation !== operation) throw new ApiError(409, 'Idempotency key reused'); entity = previous.entity; return; }
      const invoice = await collection('invoices').findOneAndUpdate({ id: data.invoiceId, societyId: scope.societyId, status: 'issued' }, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
      if (!invoice) throw new ApiError(409, 'Issue the invoice before recording payments or credits');
      if (resource === 'adjustments') {
        const credits = await collection('adjustments').find({ invoiceId: invoice.id, societyId: scope.societyId }, { session }).toArray();
        if (credits.reduce((n, c) => n + c.amountMinor, 0) + data.amountMinor > invoice.totalMinor) throw new ApiError(400, 'Credit exceeds invoice value');
      }
      entity = { ...data, id: randomUUID(), societyId: scope.societyId, residentId: invoice.residentId, revision: 0, userId: scope.userId, createdAt: new Date().toISOString() };
      const before = await ledgerSnapshot(db, invoice, session);
      await collection(resource).insertOne(entity, { session });
      if (resource === 'payments') {
        const allocated = Math.min(before.dueMinor, data.amountMinor);
        if (allocated) await db.collection('paymentAllocations').insertOne({ id: randomUUID(), societyId: scope.societyId, invoiceId: invoice.id, paymentId: entity.id, amountMinor: allocated, createdAt: new Date() }, { session });
      } else {
        let release = Math.max(0, before.allocatedMinor - (invoice.totalMinor - before.adjustmentsMinor - data.amountMinor));
        const allocations = await db.collection('paymentAllocations').aggregate<{ _id: string; amount: number }>([{ $match: { societyId: scope.societyId, invoiceId: invoice.id } }, { $group: { _id: '$paymentId', amount: { $sum: '$amountMinor' } } }], { session }).toArray();
        for (const allocation of allocations) {
          const amount = Math.min(Math.max(0, allocation.amount), release);
          if (amount) await db.collection('paymentAllocations').insertOne({ id: randomUUID(), societyId: scope.societyId, invoiceId: invoice.id, paymentId: allocation._id, adjustmentId: entity.id, amountMinor: -amount, createdAt: new Date() }, { session });
          release -= amount;
        }
      }
      await db.collection('idempotency').insertOne({ societyId: scope.societyId, key, operation, entity }, { session });
    }); } finally { await session.endSession(); }
    res.status(201).json(entity);
  });
  for (const resource of ['payments', 'adjustments']) router.post(`/${resource}/:id/reverse`, async (req, res) => {
    const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
    const reason = z.string().min(1).max(200).parse(req.body.reason);
    const session = client.startSession();
    try { await session.withTransaction(async () => {
      const original = await collection(resource).findOne({ societyId: scope.societyId, id: req.params.id }, { session });
      if (!original || original.reversalOf) throw new ApiError(404, 'Original entry not found');
      if (await collection(resource).findOne({ societyId: scope.societyId, reversalOf: original.id }, { session })) throw new ApiError(409, 'Already reversed');
      await collection('invoices').updateOne({ societyId: scope.societyId, id: original.invoiceId }, { $inc: { revision: 1 } }, { session });
      if (resource === 'payments') {
        const rows = await db.collection('paymentAllocations').find({ societyId: scope.societyId, invoiceId: original.invoiceId, paymentId: original.id }, { session }).toArray();
        const allocated = rows.reduce((s, r) => s + r.amountMinor, 0);
        if (allocated) await db.collection('paymentAllocations').insertOne({ id: randomUUID(), societyId: scope.societyId, invoiceId: original.invoiceId, paymentId: original.id, amountMinor: -allocated, reversal: true, createdAt: new Date() }, { session });
      }
      await collection(resource).insertOne({ id: randomUUID(), societyId: scope.societyId, revision: 0, residentId: original.residentId, invoiceId: original.invoiceId, reversalOf: original.id, amountMinor: -original.amountMinor, reference: reason, createdAt: new Date().toISOString(), userId: scope.userId }, { session });
    }); } finally { await session.endSession(); }
    res.json({ ok: true });
  });
  return router;
}
