// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { createElement, useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider, useI18n } from '../src/i18n';

afterEach(() => { cleanup(); localStorage.clear(); });
function Probe({ account }: { account: string }) {
  const { locale, setLocale, setAccount, t } = useI18n();
  useEffect(() => setAccount(account), [account, setAccount]);
  return createElement('div', null,
    createElement('p', { 'data-testid': 'locale' }, locale),
    createElement('input', { 'aria-label': 'Customer name', defaultValue: 'അനു 001' }),
    createElement('button', { onClick: () => setLocale('ml-IN') }, 'Malayalam'),
    createElement('button', { onClick: () => setLocale('hi-IN') }, 'Hindi'),
    createElement('span', null, t('Save record')));
}
it('keeps form values while changing languages and restores each owner preference', async () => {
  localStorage.setItem('presstrack.locale.second-owner', 'hi-IN');
  const view = render(createElement(I18nProvider, null, createElement(Probe, { account: 'first-owner' })));
  fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'B-012 അനു' } });
  fireEvent.click(screen.getByText('Malayalam'));
  expect(screen.getByTestId('locale').textContent).toBe('ml-IN');
  expect((screen.getByLabelText('Customer name') as HTMLInputElement).value).toBe('B-012 അനു');
  expect(localStorage.getItem('presstrack.locale.first-owner')).toBe('ml-IN');
  view.rerender(createElement(I18nProvider, null, createElement(Probe, { account: 'second-owner' })));
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('hi-IN'));
  view.rerender(createElement(I18nProvider, null, createElement(Probe, { account: 'first-owner' })));
  await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('ml-IN'));
  expect(document.documentElement.lang).toBe('ml-IN');
});
