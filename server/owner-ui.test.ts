// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountContext } from '../src/features/workspace/context';
import { DeliveryScreen, SettingsScreen, SubscriptionsScreen } from '../src/features/workspace/Screens';
import { I18nProvider } from '../src/i18n/index';
import type { Session } from '../src/services/api';

const session: Session = { userId: 'owner', societyId: 'business', role: 'admin', name: 'Owner', email: 'owner@example.test', society: { name: 'Daily round', currency: 'INR', timezone: 'Asia/Kolkata' } };
function mount(component: typeof SubscriptionsScreen) {
  return render(createElement(I18nProvider, { children: createElement(AccountContext.Provider, { value: session }, createElement(component)) }));
}
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

it('offers an owner subscription form and catalog without staff controls or staff reads', async () => {
  const paths: string[] = [];
  vi.stubGlobal('fetch', async (path: string) => {
    paths.push(path);
    return new Response(JSON.stringify({ items: [] }), { headers: { 'Content-Type': 'application/json' } });
  });
  const user = userEvent.setup();
  mount(SubscriptionsScreen);
  await user.click(screen.getByRole('button', { name: /Add subscription/i }));
  expect(screen.queryByLabelText('Delivery staff')).toBeNull();
  expect(screen.getByLabelText('Newspaper')).toBeTruthy();
  expect(paths.some(path => path.includes('/staff'))).toBe(false);
  cleanup();
  mount(SettingsScreen);
  expect(screen.queryByRole('tab', { name: 'Delivery staff' })).toBeNull();
});

it('confirms only reviewed pending stops and preserves unchecked and paused exceptions', async () => {
  const jobs = [
    { id: 'one', revision: 2, status: 'pending', unit: 'A1', residentName: 'Anu', publicationName: 'MM', orderedQuantity: 1, deliveredQuantity: 0 },
    { id: 'two', revision: 3, status: 'pending', unit: 'A2', residentName: 'Binu', publicationName: 'HD', orderedQuantity: 2, deliveredQuantity: 0 },
    { id: 'paused', revision: 0, status: 'paused', unit: 'A3', residentName: 'Chinju', publicationName: 'MB', orderedQuantity: 1, deliveredQuantity: 0 },
  ];
  const writes: { path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') {
      writes.push({ path, body: JSON.parse(String(options.body)) });
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ items: jobs }), { headers: { 'Content-Type': 'application/json' } });
  });
  const user = userEvent.setup();
  mount(DeliveryScreen);
  await user.click(await screen.findByRole('button', { name: 'Confirm today’s round' }));
  const checks = screen.getAllByRole('checkbox');
  expect(checks).toHaveLength(2);
  await user.click(checks[1]);
  await user.click(screen.getByRole('button', { name: 'Confirm selected deliveries' }));
  await waitFor(() => expect(writes).toEqual([{ path: '/api/v1/deliveries/one', body: { revision: 2, status: 'delivered', deliveredQuantity: 1 } }]));
  expect(screen.getByRole('status').textContent).toBe('Confirmed 1 deliveries.');
});
