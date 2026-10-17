import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
  test(`first-visit guide, preview, dismissal and login at ${viewport.width}px`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    await context.addInitScript(() => { Reflect.deleteProperty(Navigator.prototype, 'serviceWorker'); });
    const page = await context.newPage();
    const origin = new URL(baseURL || 'http://localhost:3000').origin;
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/profile') return route.fulfill({ json: { fid: 123, username: 'amanda', display_name: 'Amanda', casts: [] } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { data: [], notifications: [], casts: [] } });
      return route.continue();
    });
    try {
      await page.goto(origin);
      const guide = page.getByRole('dialog', { name: 'Make Homiehouse your home' });
      await expect(guide).toBeVisible();
      await page.getByText('Find your familiar face', { exact: true }).click();
      await page.getByLabel('Farcaster username', { exact: true }).fill('@amanda');
      await page.getByRole('button', { name: 'Preview profile', exact: true }).click();
      await expect(page.getByRole('button', { name: 'View profile and casts' })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('hh_profile'))).toBeNull();
      expect(await guide.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.getByRole('button', { name: 'Maybe later', exact: true }).click();
      await page.reload();
      await expect(page.getByRole('button', { name: 'Getting started', exact: true })).toBeVisible();
      await expect(guide).toHaveCount(0);
      await page.getByRole('button', { name: 'Getting started', exact: true }).click();
      await expect(guide).toBeVisible();
      await page.getByRole('button', { name: 'Use my existing account', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Sign in with your wallet', exact: true })).toBeVisible();
      await expect(guide).toHaveCount(0);
    } finally { await context.close(); }
  });
}
