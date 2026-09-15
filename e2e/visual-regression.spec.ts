import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests — Playwright screenshot snapshots
 * Captures key pages and compares against baseline images.
 * Run `npx playwright test --update-snapshots` to update baselines.
 */

test.describe('Visual regression — key pages', () => {
  test('home page visual snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });

  test('feed page visual snapshot', async ({ page }) => {
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('feed.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });

  test('learning hub visual snapshot', async ({ page }) => {
    await page.goto('/learning');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('learning.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });
});
