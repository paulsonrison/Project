import { expect, it, vi } from 'vitest';
import type { Db } from 'mongodb';
import { allowedTools, executeTool } from './service.js';
it('gives staff only route tools and rejects model supplied identity arguments', async () => {
  const scope = { userId: 'u', societyId: 'a', role: 'staff' as const, staffId: 's' };
  expect(allowedTools(scope)).toEqual(['getMyRoute']);
  const collection = vi.fn();
  await expect(executeTool({ collection } as unknown as Db, scope, 'listMyInvoices', {})).rejects.toThrow('authorized');
  await expect(executeTool({ collection } as unknown as Db, scope, 'getMyRoute', { societyId: 'victim' })).rejects.toThrow();
  expect(collection).not.toHaveBeenCalled();
});
