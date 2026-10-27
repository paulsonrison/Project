export interface NavigationLink { path: string; label: string; icon?: string }
export interface NavigationGroup extends NavigationLink { tabs: NavigationLink[] }
export const ownerNavigation: NavigationGroup[] = [
  { path: '/today', label: 'Today', icon: '↗', tabs: [{ path: '/today', label: 'Deliveries' }, { path: '/calendar', label: 'Calendar' }, { path: '/dashboard', label: 'Overview' }] },
  { path: '/residents', label: 'Customers', icon: '♙', tabs: [{ path: '/residents', label: 'Customers' }, { path: '/subscriptions', label: 'Subscriptions' }, { path: '/pauses', label: 'Pauses' }, { path: '/complaints', label: 'Delivery concerns' }] },
  { path: '/newspapers', label: 'Newspapers', icon: '▤', tabs: [{ path: '/newspapers', label: 'Newspapers' }, { path: '/pricing', label: 'Rate history' }] },
  { path: '/billing', label: 'Bills', icon: '▱', tabs: [{ path: '/billing', label: 'Bills' }, { path: '/payments', label: 'Payments' }] },
  { path: '/settings', label: 'Settings', icon: '⚙', tabs: [{ path: '/settings', label: 'Preferences' }, { path: '/service-policies', label: 'Service policies' }, { path: '/chat', label: 'Account assistant' }] },
];
export function navigationForPath(path: string) {
  const primary = ownerNavigation.find(group => group.tabs.some(tab => tab.path === path)) ?? ownerNavigation[0];
  return { primary, tabs: primary.tabs, title: primary.tabs.find(tab => tab.path === path)?.label ?? primary.label };
}
