import { expect, type Page } from '@playwright/test';
export async function acceptDefaultSetup(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Set up your business', exact: true });
  await expect(dialog).toBeVisible({timeout:15000});
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
