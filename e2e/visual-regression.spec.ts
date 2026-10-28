import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Visual Regression Tests — Playwright screenshot snapshots
 * Captures key pages and compares against baseline images.
 * Run `npx playwright test --update-snapshots` to update baselines.
 *
 * In CI, tests are skipped if no baseline snapshot exists yet.
 * Run `npx playwright test --update-snapshots` locally to generate baselines,
 * then commit them to the repo.
 */

const snapshotDir = join(__dirname, 'visual-regression.spec.ts-snapshots');

function hasBaseline(name: string): boolean {
  if (!existsSync(snapshotDir)) return false;
  // Playwright stores baselines as <name>-<browser>-<platform>.png
  const pattern = new RegExp(`^${name}-chromium-(linux|darwin|win32)\\.png$`);
  const { readdirSync } = require('fs');
  return readdirSync(snapshotDir).some((f: string) => pattern.test(f));
}

test.describe('Visual regression — key pages', () => {
  test('home page visual snapshot', async ({ page }) => {
    test.skip(!hasBaseline('home'), 'No baseline snapshot — run with --update-snapshots to generate');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });

  test('feed page visual snapshot', async ({ page }) => {
    test.skip(!hasBaseline('feed'), 'No baseline snapshot — run with --update-snapshots to generate');
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('feed.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });

  test('learning hub visual snapshot', async ({ page }) => {
    test.skip(!hasBaseline('learning'), 'No baseline snapshot — run with --update-snapshots to generate');
    await page.goto('/learning');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('learning.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });
});
