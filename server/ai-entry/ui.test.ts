// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiEntry from '../../src/features/imports/AiEntry';
import { I18nProvider } from '../../src/i18n';

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

it('keeps customer details out of the AI request and requires payload consent plus final review', async () => {
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const onSaved = vi.fn();
  vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    if (options?.method === 'POST') writes.push({ path, body });
    const response = path.startsWith('/api/v1/publications') ? { items: [{ id: 'paper-1', revision: 0, code: 'MM', name: 'Malayala Manorama' }] }
      : path === '/api/v1/ai-entry/payload' ? { payload: { startDate: '2026-11-01', publications: [{ code: 'MM', name: 'Malayala Manorama', quantity: 2 }] }, hash: 'a'.repeat(64) }
      : path === '/api/v1/ai-entry/propose' ? { subscriptions: [{ code: 'MM', quantity: 2, startDate: '2026-11-01' }] }
      : path === '/api/v1/imports/preview' ? { id: 'batch', changes: [{ action: 'create', label: 'Private Reader' }], errors: [] }
      : { changed: 2 };
    return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' } });
  });
  render(createElement(I18nProvider, { children: createElement(AiEntry, { entity: 'residents', onSaved }) }));
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Add with AI' }));
  await user.type(screen.getByLabelText('Full name'), 'Private Reader');
  await user.type(screen.getByLabelText('Address/Flat'), 'Private Flat');
  await user.type(screen.getByLabelText('Phone'), '9000012345');
  await user.type(screen.getByLabelText('Address', { exact: true }), 'Private Address');
  await user.type(screen.getByLabelText('First delivery date'), '2026-11-01');
  await user.type(await screen.findByLabelText(/Malayala Manorama/), '2');
  await user.click(screen.getByRole('button', { name: 'Review what Groq would receive' }));
  await screen.findByRole('heading', { name: 'Newspaper choices for Groq' });
  expect((screen.getByRole('button', { name: 'Prepare with Groq' }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole('checkbox', { name: 'I agree to send only these newspaper choices to Groq.' }));
  await user.click(screen.getByRole('button', { name: 'Prepare with Groq' }));
  await screen.findByRole('heading', { name: 'Proposed subscriptions' });
  const aiRequests = writes.filter(write => write.path.includes('/ai-entry/'));
  for (const privateValue of ['Private Reader', 'Private Flat', '9000012345', 'Private Address']) expect(JSON.stringify(aiRequests)).not.toContain(privateValue);
  expect(writes.some(write => write.path.includes('/imports/'))).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Review customer and subscriptions' }));
  await screen.findByRole('heading', { name: 'Review changes' });
  expect(writes.find(write => write.path === '/api/v1/imports/preview')?.body.rows).toEqual([{ Name: 'Private Reader', Number: '9000012345', 'Address/Flat': 'Private Flat', Address: 'Private Address', 'Start Date': '2026-11-01', 'Subscription: MM': '2' }]);
  expect((screen.getByRole('button', { name: 'Save reviewed changes' }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole('checkbox', { name: 'I reviewed these changes' }));
  await user.click(screen.getByRole('button', { name: 'Save reviewed changes' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
});
