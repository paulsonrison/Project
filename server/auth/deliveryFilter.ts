import type { Db } from 'mongodb';
import type { AccessScope } from '../../shared/contracts.js';
import { visibleFilter } from './scope.js';
export async function deliveryFilter(db: Db, scope: AccessScope): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = visibleFilter(scope, 'deliveries');
  if (scope.role === 'staff') {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const subscriptions = await db.collection('subscriptions').find({ societyId: scope.societyId, staffId: scope.staffId, archived: { $ne: true }, $or: [{ endDate: { $exists: false } }, { endDate: { $gt: today } }] }, { projection: { id: 1 } }).toArray();
    delete filter.staffId;
    filter.subscriptionId = { $in: subscriptions.map(s => s.id) };
  }
  return filter;
}
