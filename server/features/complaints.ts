import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AccessScope } from '../../shared/contracts.js';
import type { Dependencies } from '../app.js';
import type { Entity } from '../db/connect.js';
import { ApiError, requireRole } from '../auth/scope.js';
import { ledgerSnapshot, releaseAllocations } from '../domain/ledger.js';
export function complaintRoutes({ db, client }: Dependencies) {
  const router = Router();
  router.post('/complaints/:id/review', async (req, res) => {
    const scope: AccessScope = res.locals.scope; requireRole(scope, 'admin');
    const data = z.object({ status: z.enum(['accepted', 'rejected']), reason: z.string().trim().min(1).max(200) }).parse(req.body);
    const session = client.startSession();
    try { await session.withTransaction(async () => {
      const complaint = await db.collection('complaints').findOneAndUpdate({ societyId: scope.societyId, id: req.params.id, status: { $nin: ['accepted', 'rejected'] } }, { $set: { status: data.status, reviewReason: data.reason, reviewedAt: new Date(), reviewedBy: scope.userId }, $inc: { revision: 1 } }, { session, returnDocument: 'after' });
      if (!complaint) throw new ApiError(409, 'Complaint missing or already reviewed');
      if (data.status === 'rejected') return;
      const job = await db.collection<Entity>('deliveries').findOne({ societyId: scope.societyId, id: complaint.deliveryId, residentId: complaint.residentId }, { session });
      if (!job) throw new ApiError(404, 'Delivery not found');
      if (job.complaintResolved) throw new ApiError(409, 'This delivery already has an accepted claim');
      if (job.invoiceId) {
        const invoice = await db.collection<Entity>('invoices').findOneAndUpdate({ societyId: scope.societyId, id: job.invoiceId }, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
        if (!invoice) throw new ApiError(404, 'Invoice not found');
        const amountMinor = job.billableQuantity * job.priceMinor, snapshot = await ledgerSnapshot(db, invoice, session);
        if (snapshot.adjustmentsMinor + amountMinor > invoice.totalMinor) throw new ApiError(409, 'Invoice has already been credited; review existing adjustments');
        const id = randomUUID();
        await db.collection('adjustments').insertOne({ id, societyId: scope.societyId, residentId: job.residentId, invoiceId: invoice.id, amountMinor, complaintId: complaint.id, reference: data.reason, revision: 0, createdAt: new Date().toISOString() }, { session });
        await releaseAllocations(db, invoice, id, snapshot.adjustmentsMinor + amountMinor, session);
      }
      await db.collection('deliveries').updateOne({ societyId: scope.societyId, id: job.id }, { $set: { complaintResolved: true, ...(!job.invoiceId ? { status: 'missed', billableQuantity: 0 } : {}) }, $inc: { revision: 1 } }, { session });
    }); } finally { await session.endSession(); }
    res.json({ ok: true });
  });
  return router;
}
