// @vitest-environment jsdom
import { createElement, useState } from 'react';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dialog from '../src/components/common/Dialog';
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(cleanup);
it('labels dialogs, locks background scrolling and restores the opening control after dismissal', async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return createElement('div', null,
      createElement('button', { onClick: () => setOpen(true) }, 'Open customer'),
      open && createElement(Dialog, { title: 'Customer details', onClose: () => setOpen(false), children: createElement('input', { 'aria-label': 'Name' }) }),
    );
  }
  const user = userEvent.setup(); document.documentElement.style.overflow = 'auto';
  render(createElement(Example));
  await user.click(screen.getByRole('button', { name: 'Open customer' }));
  expect(screen.getByRole('dialog', { name: 'Customer details' })).toBeTruthy();
  expect(document.documentElement.style.overflow).toBe('hidden');
  await user.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(document.documentElement.style.overflow).toBe('auto');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open customer' }));
});
