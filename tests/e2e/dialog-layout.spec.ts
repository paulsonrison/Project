import { expect, test } from '@playwright/test';
import { acceptDefaultSetup } from './helpers';

test('owner navigation stays compact and dialogs center within the viewport', async ({ page }, testInfo) => {
  await page.goto('/signin?mode=register');
  await page.getByLabel('Your name').fill('Layout Owner');
  await page.getByLabel('Email address').fill(`layout-${Date.now()}@example.test`);
  await page.getByLabel('Society / business name').fill('Layout Round');
  await page.getByLabel('Password', { exact: true }).fill('layout-owner-password-123');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await acceptDefaultSetup(page);
  await expect(page.locator('.sidebar nav a')).toHaveCount(5);
  await page.goto('/residents');
  for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 360, height: 800 }]) {
    await page.setViewportSize(size);
    await page.getByRole('button', { name: /Add customer/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(220);
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x + box!.width / 2 - size.width / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(box!.y + box!.height / 2 - size.height / 2)).toBeLessThanOrEqual(2);
    expect(box!.x).toBeGreaterThanOrEqual(15);
    expect(box!.y).toBeGreaterThanOrEqual(15);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width - 15);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height - 15);
    const language = await page.locator('.workspace-header .language-switcher').boundingBox();
    expect(language!.x + language!.width).toBeGreaterThan(size.width - 42);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`dialog-${size.width}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Add customer/i })).toBeFocused();
  }
  await page.goto('/subscriptions');
  await expect(page.locator('.sidebar a.active')).toContainText('Customers');
  await expect(page.getByRole('navigation', { name: 'Page sections' })).toBeVisible();
});
