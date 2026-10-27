import { test, expect } from '@playwright/test';

const firstHash = '0x' + 'a'.repeat(40);
const otherHash = '0x' + 'b'.repeat(40);
const author = { fid: 321, username: 'navigationtest', display_name: 'Navigation Test' };
const cast = (hash: string) => ({ hash, text: 'Home preview ' + hash, author, timestamp: '2026-10-17T12:00:00Z', embeds: [], reactions: {}, replies: { count: 0, casts: [] } });

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1280, height: 800 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport, serviceWorkers: 'block' });

    test('Home Feed destination and mobile drawer open the full Following feed', async ({ page }) => {
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://localhost:3000') return route.abort();
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
        return route.continue();
      });
      await page.addInitScript(() => {
        localStorage.setItem('hh_profile', JSON.stringify({ fid: 321, username: 'navigationtest' }));
        sessionStorage.setItem('hh_session_v1', JSON.stringify({ fid: 321, expiresAt: Date.now() + 3600000 }));
        localStorage.setItem('hh_migration_guide_v1', 'dismissed');
      });
      await page.route('**/api/feed?**', route => {
        return route.fulfill({ json: { data: [cast(firstHash)], cursor: null } });
      });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /^Home/ })).toBeVisible();
      await page.getByRole('link', { name: /Go to your feed/ }).click();
      await expect(page).toHaveURL('/feed');
      await expect(page.getByRole('button', { name: 'Following', exact: true })).toHaveAttribute('aria-pressed', 'true');
      if (viewport.width < 1024) {
        await page.getByRole('button', { name: 'Open menu' }).click();
        await page.getByRole('link', { name: 'Feed', exact: true }).filter({ visible: true }).last().click();
        await expect(page.getByRole('button', { name: 'Close menu' })).toBeHidden();
        await expect(page).toHaveURL('/feed');
      }
    });
  });
}
