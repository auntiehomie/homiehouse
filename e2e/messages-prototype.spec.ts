import { expect, test } from '@playwright/test';

test('local message prototype sends to the other demo account in the same tab', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/messages/prototype');

  await expect(page.getByRole('heading', { name: 'Direct messages' })).toBeVisible();
  await expect(page.getByText('Local demo only.', { exact: false })).toBeVisible();
  await expect(page.getByText('No demo messages yet.', { exact: false })).toBeVisible();

  await page.getByLabel('Message as Test account A').fill('Testing the inbox with a local message');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Testing the inbox with a local message')).toBeVisible();

  await page.getByLabel('Preview as').selectOption('demo-account-b');
  await expect(page.getByText('Testing the inbox with a local message')).toBeVisible();
  await expect(page.getByText('Test account A', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  await page.reload();
  await expect(page.getByText('No demo messages yet.', { exact: false })).toBeVisible();
});
