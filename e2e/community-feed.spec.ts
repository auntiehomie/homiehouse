import { test, expect } from '@playwright/test';

for (const width of [390, 820, 1280]) {
  test(`Community is optional and explains ranking at ${width}px`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, 'serviceWorker');
      localStorage.setItem('hh_profile', JSON.stringify({ fid: 321, username: 'fixture' }));
      sessionStorage.setItem('hh_session_v1', JSON.stringify({ fid: 321, expiresAt: Date.now() + 3600000 }));
    });
    const page = await context.newPage();
    const origin = new URL(baseURL || 'http://localhost:3000').origin;
    const cast = { hash: '0x' + 'a'.repeat(40), text: 'A community conversation', timestamp: new Date().toISOString(), author: { fid: 123, username: 'author' } };
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/feed') {
        const community = url.searchParams.get('feed_type') === 'community';
        return route.fulfill({ json: { data: [{ ...cast, text: community ? cast.text : 'Following conversation', ...(community ? { community_ranking: { reasons: ['Limited casting history; neutral history and participation scores'] } } : {}) }], cursor: null } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
      return route.continue();
    });
    try {
      await page.goto('/feed');
      await expect(page.getByRole('button', { name: 'Following', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText('Following conversation', { exact: true })).toBeVisible();
      const tab = page.getByRole('button', { name: 'Community', exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText(cast.text, { exact: true })).toBeVisible();
      const box = (await tab.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      await page.getByText('Why this cast?', { exact: true }).click();
      await expect(page.getByText('Limited casting history; neutral history and participation scores', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Following', exact: true }).click();
      await expect(page.getByText('Following conversation', { exact: true })).toBeVisible();
      await expect(page.getByText('Why this cast?', { exact: true })).toHaveCount(0);
    } finally { await context.close(); }
  });
}
