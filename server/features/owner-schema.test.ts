import { expect, it } from 'vitest';
import { schemas } from './schemas.js';

it('accepts an owner subscription without a staff assignment', () => {
  const result = schemas.subscriptions.safeParse({ residentId: '11111111-1111-4111-8111-111111111111', publicationId: '22222222-2222-4222-8222-222222222222', startDate: '2026-01-01' });
  expect(result.success).toBe(true);
  if (result.success) expect(result.data).not.toHaveProperty('staffId');
});
