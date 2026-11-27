import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1280, height: 800 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport, serviceWorkers: 'block' });

    test('Home destination card opens the full feed in Following view', async ({ page }) => {
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
      await page.route('**/api/learning-progress?**', route => route.fulfill({ json: {
        hh2_points: 700, plan: { summary: 'Learning summary. '.repeat(50), modules: [] },
      } }));
      await page.route('**/api/feed?**', route => route.fulfill({ json: { data: [], cursor: null } }));

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /Home/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Browse the course catalog/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Ask a question/ })).toBeVisible();

      await page.getByRole('link', { name: /Go to your feed/ }).click();
      await expect(page).toHaveURL('/feed');
      const following = page.getByRole('button', { name: 'Following', exact: true });
      await expect(following).toBeVisible();
      await expect(following).toHaveAttribute('aria-pressed', 'true');
    });
  });
}
