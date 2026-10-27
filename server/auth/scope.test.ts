import { expect, it } from 'vitest';
import { visibleFilter, requireRole } from './scope.js';
it('never accepts client tenant identity and limits resident and staff visibility', () => {
  expect(visibleFilter({ userId: 'u', societyId: 'a', role: 'resident', residentId: 'r' }, 'invoices')).toEqual({ societyId: 'a', residentId: 'r' });
  expect(() => visibleFilter({ userId: 'u', societyId: 'a', role: 'staff', staffId: 's' }, 'invoices')).toThrow('Forbidden');
  expect(visibleFilter({ userId: 'u', societyId: 'a', role: 'staff', staffId: 's' }, 'deliveries')).toEqual({ societyId: 'a', staffId: 's' });
  expect(() => requireRole({ userId: 'u', societyId: 'a', role: 'resident' }, 'admin')).toThrow('Forbidden');
});
