import type { ClientSession, Db } from 'mongodb';
import type { Entity } from '../db/connect.js';
export async function ledgerSnapshot(db: Db, invoice: Entity, session?: ClientSession) {
  const filter = { societyId: invoice.societyId, invoiceId: invoice.id };
  const payments = await db.collection('payments').find(filter, { session }).toArray();
  const credits = await db.collection('adjustments').find(filter, { session }).toArray();
  const allocations = await db.collection('paymentAllocations').find(filter, { session }).toArray();
  const paidMinor = payments.reduce((s, p) => s + p.amountMinor, 0);
  const adjustmentsMinor = credits.reduce((s, p) => s + p.amountMinor, 0);
  const allocatedMinor = allocations.reduce((s, p) => s + p.amountMinor, 0);
  return { paidMinor, adjustmentsMinor, allocatedMinor, dueMinor: Math.max(0, invoice.totalMinor - adjustmentsMinor - allocatedMinor), creditMinor: Math.max(0, paidMinor - allocatedMinor) };
}
export async function releaseAllocations(db: Db, invoice: Entity, adjustmentId: string, totalCredits: number, session: ClientSession) {
  const before = await ledgerSnapshot(db, invoice, session);
  let release = Math.max(0, before.allocatedMinor - (invoice.totalMinor - totalCredits));
  const groups = await db.collection('paymentAllocations').aggregate<{ _id: string; amount: number }>([{ $match: { societyId: invoice.societyId, invoiceId: invoice.id } }, { $group: { _id: '$paymentId', amount: { $sum: '$amountMinor' } } }], { session }).toArray();
  for (const group of groups) {
    const amount = Math.min(Math.max(0, group.amount), release);
    if (amount) await db.collection('paymentAllocations').insertOne({ id: crypto.randomUUID(), societyId: invoice.societyId, invoiceId: invoice.id, paymentId: group._id, adjustmentId, amountMinor: -amount, createdAt: new Date() }, { session });
    release -= amount;
  }
}
