import { test, expect } from '@playwright/test';
import { PREMIUM_TRACKS } from '../src/lib/premium-curriculum';

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1280, height: 800 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport, serviceWorkers: 'block' });

    test('paid checkout return unlocks premium listing and lesson; Messages links retain the existing service', async ({ page }) => {
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://localhost:3000') return route.abort();
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
        return route.continue();
      });
      await page.addInitScript(() => {
        localStorage.setItem('hh_profile', JSON.stringify({ fid: 321, username: 'protest' }));
        const token = `header.${btoa(JSON.stringify({ scopes: ['read:all'] }))}.signature`;
        sessionStorage.setItem('hh_session_v1', JSON.stringify({ fid: 321, token, expiresAt: Date.now() + 3600000 }));
      });
      let checks = 0;
      await page.route('**/api/pro-status?**', route => {
        if (!route.request().headers()['x-session-token']) return route.fulfill({ status: 401, json: { ok: false, error: 'Missing auth' } });
        return route.fulfill({ json: { ok: true, is_pro: ++checks > 1 } });
      });
      const module = PREMIUM_TRACKS[0].modules[0];
      await page.route('**/api/premium-track**', route => {
        if (!route.request().headers()['x-session-token']) return route.fulfill({ status: 401, json: { ok: false, error: 'Missing auth' } });
        return route.fulfill({ json: { ok: true, unlocked: true, pro_required: false,
          tracks: PREMIUM_TRACKS.map(track => ({ ...track, moduleCount: track.modules.length, totalMinutes: 80 })),
          module, lesson: { concepts: [{ title: 'Paid lesson content', explanation: 'Full lesson evidence.' }] },
        } });
      });
      await page.goto('/pro?status=success', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('⚡ Active', { exact: true })).toBeVisible({ timeout: 15000 });
      await page.getByRole('link', { name: '📚 Go to Learning Hub →' }).click();
      await page.getByRole('button', { name: '⭐ Premium', exact: true }).click();
      await expect(page.getByText('You have full access to all premium content.', { exact: false })).toBeVisible();
      await page.getByText(module.title, { exact: true }).click();
      await expect(page).toHaveURL(`/learn/premium/${module.id}`);
      await expect(page.getByText('Paid lesson content', { exact: true })).toBeVisible();
      await page.goto('/messages', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Private messages', exact: true })).toBeVisible();
      await page.getByLabel('Recipient FID').fill('3103');
      await expect(page.getByLabel('Recipient FID')).toHaveValue('3103');
      await expect(page.getByRole('button', { name: 'Encrypted messaging is not available yet' })).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    });
  });
}
