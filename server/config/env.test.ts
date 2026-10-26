import { expect, it } from 'vitest';
import { readEnv } from './env.js';
it('fails closed without database and origin', () => {
  expect(() => readEnv({})).toThrow();
  expect(readEnv({ MONGODB_URI: 'mongodb://localhost:27017', APP_ORIGIN: 'http://localhost:5173' }).port).toBe(3001);
});
