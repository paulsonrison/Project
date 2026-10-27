import { expect, test } from '@playwright/test';

test('language switching preserves an unsaved form and survives reload', async ({ page }) => {
  await page.goto('/signin?mode=register');
  await page.getByLabel('Your name').fill('അനു B-012');
  await page.getByLabel('Email address').fill('language-test@example.test');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ml-IN');
  await expect(page.getByLabel('നിങ്ങളുടെ പേര്')).toHaveValue('അനു B-012');
  await expect(page.getByLabel('ഇമെയിൽ വിലാസം')).toHaveValue('language-test@example.test');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ml-IN');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'ഭാഷ', exact: true })).toHaveValue('ml-IN');
  await page.getByRole('combobox', { name: 'ഭാഷ', exact: true }).selectOption('hi-IN');
  await expect(page.getByLabel('आपका नाम')).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
