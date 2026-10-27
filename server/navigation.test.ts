import { expect, it } from 'vitest';
import { ownerNavigation, navigationForPath } from '../src/features/workspace/navigation';

it('keeps owner navigation to five primary choices and maps deep links to their parent', () => {
  expect(ownerNavigation.map(item => item.label)).toEqual(['Today', 'Customers', 'Newspapers', 'Bills', 'Settings']);
  expect(navigationForPath('/subscriptions').primary.path).toBe('/residents');
  expect(navigationForPath('/pricing').primary.path).toBe('/newspapers');
  expect(navigationForPath('/payments').primary.path).toBe('/billing');
  expect(navigationForPath('/chat').primary.path).toBe('/settings');
  expect(navigationForPath('/calendar').tabs.map(item => item.path)).toContain('/today');
});
