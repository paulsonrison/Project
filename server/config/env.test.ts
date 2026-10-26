import { expect, it } from 'vitest';
import { readEnv } from './env.js';
it('fails closed without database and origin', () => {
  expect(() => readEnv({})).toThrow();
  expect(readEnv({ MONGODB_URI: 'mongodb://localhost:27017', APP_ORIGIN: 'http://localhost:5173' }).port).toBe(3001);
});
it('uses the platform-generated HTTPS origin on Render', () => {
  expect(readEnv({ MONGODB_URI: 'mongodb://localhost:27017', RENDER_EXTERNAL_URL: 'https://presstrack-test.onrender.com', NODE_ENV: 'production' }).origin).toBe('https://presstrack-test.onrender.com');
});
