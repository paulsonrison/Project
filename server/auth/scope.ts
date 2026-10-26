import type { AccessScope, Role } from '../../shared/contracts.js';
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireRole(scope: AccessScope, ...roles: Role[]) {
  if (!roles.includes(scope.role)) throw new ApiError(403, 'Forbidden');
}
export function visibleFilter(scope: AccessScope, resource: string): Record<string, string> {
  const tenant = { societyId: scope.societyId };
  if (scope.role === 'admin') return tenant;
  if (scope.role === 'resident' && scope.residentId) {
    if (resource === 'residents') return { ...tenant, id: scope.residentId };
    if (['subscriptions', 'pauses', 'deliveries', 'invoices', 'payments', 'complaints', 'adjustments'].includes(resource)) return { ...tenant, residentId: scope.residentId };
    if (resource === 'publications') return tenant;
  }
  if (scope.role === 'staff' && scope.staffId && resource === 'deliveries') return { ...tenant, staffId: scope.staffId };
  throw new ApiError(403, 'Forbidden');
}
