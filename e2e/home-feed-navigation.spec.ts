import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1280, height: 800 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport, serviceWorkers: 'block' });

    test('Home destinations open the full feed from the card and navigation', async ({ page }) => {
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

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /Home/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Browse the course catalog/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Ask a question/ })).toBeVisible();

      await page.getByRole('link', { name: /Go to your feed/ }).click();
      await expect(page).toHaveURL('/feed');
      const following = page.getByRole('button', { name: 'Following', exact: true });
      await expect(following).toBeVisible();
      await following.click();
      await expect(following).toHaveAttribute('aria-pressed', 'true');

      if (viewport.width < 1024) {
        await page.getByRole('button', { name: 'Open menu' }).click();
        await page.getByRole('link', { name: 'Feed', exact: true }).filter({ visible: true }).last().click();
        await expect(page.getByRole('button', { name: 'Close menu' })).toBeHidden();
        await expect(page).toHaveURL('/feed');
      } else {
        await page.goto('/');
        await page.getByRole('link', { name: 'Feed', exact: true }).click();
        await expect(page).toHaveURL('/feed');
      }
    });
  });
}
