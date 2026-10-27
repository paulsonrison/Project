import { afterEach, expect, it, vi } from 'vitest';
import { buildPublicPayload, suggestSubscriptions } from './service.js';
import { proposalInput } from './schemas.js';
import type { Config } from '../config/env.js';

const config: Config = { mongoUri: 'mongodb://localhost/test', database: 'test', origin: 'http://localhost', port: 3001, production: false, groqModel: 'test-model', groqKey: 'private-test-key' };
const input = { consentToGroq: true as const, startDate: '2026-11-01', selections: [{ code: 'MM', quantity: 2 }] };
const papers = [{ code: 'MM', name: 'Malayala Manorama' }];
const expected = { subscriptions: [{ code: 'MM', quantity: 2, startDate: '2026-11-01' }] };
afterEach(() => vi.unstubAllGlobals());

it('rejects private fields and free text before any provider request', () => {
  for (const forbidden of ['text', 'name', 'phone', 'address', 'unit', 'residentId', 'societyId']) expect(proposalInput.safeParse({ ...input, [forbidden]: 'private' }).success).toBe(false);
  expect(proposalInput.safeParse({ ...input, selections: [{ code: 'MM', quantity: 1, name: 'private' }] }).success).toBe(false);
  expect(proposalInput.safeParse({ ...input, consentToGroq: false }).success).toBe(false);
  expect(proposalInput.safeParse({ ...input, selections: [{ code: 'MM', quantity: 101 }] }).success).toBe(false);
});

it('builds the entire external payload from known newspaper codes and explicit quantities/date', () => {
  expect(buildPublicPayload(input, papers)).toEqual({ startDate: '2026-11-01', publications: [{ code: 'MM', name: 'Malayala Manorama', quantity: 2 }] });
  expect(() => buildPublicPayload({ ...input, selections: [{ code: 'UNKNOWN', quantity: 1 }] }, papers)).toThrow('newspaper');
});

it('sends only the public payload and accepts only the exact reviewed choices', async () => {
  let body = '';
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => { body = String(options.body); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(expected) } }] })); });
  const result = await suggestSubscriptions(config, input, papers);
  expect(result).toEqual(expected);
  const messages = JSON.parse(body).messages;
  expect(JSON.parse(messages[1].content)).toEqual(buildPublicPayload(input, papers));
  expect(body).not.toContain(config.groqKey);
});

it('rejects invented newspaper, quantity and date values', async () => {
  for (const altered of [{ ...expected.subscriptions[0], quantity: 3 }, { ...expected.subscriptions[0], code: 'HD' }, { ...expected.subscriptions[0], startDate: '2026-11-02' }]) {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ subscriptions: [altered] }) } }] })));
    await expect(suggestSubscriptions(config, input, papers)).rejects.toThrow('reviewed choices');
  }
});

it('returns a safe error for unconfigured, invalid and unavailable providers', async () => {
  await expect(suggestSubscriptions({ ...config, groqKey: undefined }, input, papers)).rejects.toThrow('not configured');
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] })));
  await expect(suggestSubscriptions(config, input, papers)).rejects.toThrow('valid suggestion');
  vi.stubGlobal('fetch', async () => { throw new Error('private-test-key'); });
  await expect(suggestSubscriptions(config, input, papers)).rejects.toThrow('temporarily unavailable');
});
