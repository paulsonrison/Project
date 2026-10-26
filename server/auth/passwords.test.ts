import { expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.js';
it('salts password hashes and rejects invalid passwords and malformed hashes', async () => {
  const a = await hashPassword('test-long-password');
  expect(a).not.toContain('test-long-password');
  expect(a).not.toBe(await hashPassword('test-long-password'));
  expect(await verifyPassword(a, 'test-long-password')).toBe(true);
  expect(await verifyPassword(a, 'wrong-password')).toBe(false);
  expect(await verifyPassword('bad', 'test-long-password')).toBe(false);
});
