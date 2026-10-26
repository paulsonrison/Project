import { expect, test } from '@playwright/test';
test('public navigation and accessible sign-in', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /Every edition/i })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
