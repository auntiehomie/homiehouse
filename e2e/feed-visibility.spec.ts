import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 393, height: 851 }, { width: 851, height: 393 }, { width: 820, height: 1180 }, { width: 1280, height: 800 }]) {
  test(`Following freshness and visible controls at ${viewport.width}x${viewport.height}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block', hasTouch: viewport.width < 1024 });
    await context.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, 'serviceWorker');
      localStorage.setItem('hh_profile', JSON.stringify({ fid: 321, username: 'fixture' }));
      localStorage.setItem('signer_321', JSON.stringify({ status: 'approved', private_key: '01'.repeat(32) }));
    });
    const page = await context.newPage();
    await page.clock.install();
    const origin = new URL(baseURL || 'http://localhost:3000').origin;
    let reads = 0;
    const old = { hash: '0x' + 'a'.repeat(40), text: 'Previous node cast', timestamp: new Date().toISOString(), author: { fid: 123, username: 'unranked', follower_count: 0 } };
    const next = { ...old, hash: '0x' + 'b'.repeat(40), text: 'New node cast' };
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/feed') {
        expect(url.searchParams.get('feed_type')).toBe('following');
        reads++;
        return route.fulfill({ json: { data: reads === 1 ? [old] : [next, old], cursor: null } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { data: [], notifications: [], channels: [] } });
      return route.continue();
    });
    try {
      await page.goto('/feed');
      await expect(page.getByText('Previous node cast', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Following', exact: true })).toHaveAttribute('aria-pressed', 'true');
      for (const name of ['Following', 'Global', 'Trending', 'Refresh feed']) {
        const control = page.getByRole('button', { name, exact: true });
        await expect(control).toBeVisible();
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
      await page.clock.fastForward(61_000);
      await expect(page.getByRole('button', { name: 'Load 1 new casts' })).toBeVisible();
      await expect(page.getByText('New node cast', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Load 1 new casts' }).click();
      await expect(page.getByText('New node cast', { exact: true })).toBeVisible();
    } finally { await context.close(); }
  });
}
