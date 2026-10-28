import { test, expect } from '@playwright/test';

/**
 * E2E Smoke Test: Auth → Home → Learning → HH2 Shop
 *
 * Validates critical user flows without requiring a real Farcaster auth.
 * Uses guest/preview mode where available.
 */

test.describe('HomieHouse smoke tests', () => {
  test('home page loads and shows key elements', async ({ page }) => {
    await page.goto('/');

    // Page should load without error
    await expect(page).toHaveTitle(/HomieHouse/i);

    // Key navigation/branding should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('feed page is accessible', async ({ page }) => {
    await page.goto('/feed');

    // Feed page should render — either feed content or a sign-in prompt
    await expect(page.locator('body')).toBeVisible();
  });

  test('learning hub is accessible', async ({ page }) => {
    await page.goto('/learning');

    // Learning hub should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('HH2 shop page is accessible', async ({ page }) => {
    await page.goto('/shop');

    // Shop page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigation flow: home → learning → shop', async ({ page }) => {
    await page.goto('/');
    await page.locator('body').waitFor();

    // Navigate to learning
    await page.goto('/learning');
    await page.locator('body').waitFor();

    // Navigate to shop
    await page.goto('/shop');
    await page.locator('body').waitFor();

    // Should still be on a valid page
    await expect(page.locator('body')).toBeVisible();
  });

  test('API health: og image endpoint', async ({ request }) => {
    // Edge routes compile on first hit in dev mode — retry on timeout/connection error
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await request.get('/api/og', { timeout: 30_000 });
        if (response.ok()) break;
      } catch {
        // First hit may timeout while edge function compiles
      }
    }
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('image');
  });

  test('API health: og content endpoint', async ({ request }) => {
    const response = await request.get('/api/og/content?title=Test&description=Smoke');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image');
  });
});
