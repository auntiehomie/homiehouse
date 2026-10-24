import { expect, test } from '@playwright/test';

test('Messages shows and runs the two-device relay boundary test', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/messages');

  await expect(page.getByRole('heading', { name: 'Encrypted message test' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Two-device relay boundary' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run E2EE test' })).toBeVisible();
  await expect(page.getByText(/does not contact Hypersnap/i)).toBeVisible();

  await page.getByRole('button', { name: 'Run E2EE test' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'All checks passed' })).toHaveText('All checks passed');
  await expect(page.getByText('Relay fixture stores ciphertext only')).toBeVisible();
  await expect(page.getByText('Intended device decrypts the message')).toBeVisible();
  await expect(page.getByText('Unrelated device cannot decrypt')).toBeVisible();
  await expect(page.getByText('Routing metadata tampering is rejected')).toBeVisible();
  await expect(page.getByText('A private test message', { exact: true })).toBeVisible();

  await page.getByText('Inspect the relay’s stored envelope').click();
  await expect(page.locator('pre')).toContainText('ciphertext');
  await expect(page.locator('pre')).not.toContainText('A private test message');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
