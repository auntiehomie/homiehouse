import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  // Isolate UI navigation: allow only the local app and deterministic API fixtures.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://localhost:3000') return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  // Client-only identity fixture: no wallet signing or authenticated writes.
  await page.addInitScript(() => {
    localStorage.setItem('hh_profile', JSON.stringify({ fid: 321, username: 'navigationtest' }));
    sessionStorage.setItem('hh_session_v1', JSON.stringify({ fid: 321, expiresAt: Date.now() + 3600000 }));
  });
  await page.route('**/api/profile?**', route => route.fulfill({ json: { fid: 321, username: 'navigationtest' } }));
  await page.route('**/api/trending**', route => route.fulfill({ json: { casts: [] } }));
});

const parent = '0x' + 'a'.repeat(40);
const quoted = '0x' + 'b'.repeat(40);
const card = (hash: string, text: string) => ({ hash, text, author: { fid: 321, username: 'navigationtest', display_name: 'Navigation Test' }, timestamp: '2026-10-17T12:00:00Z', embeds: [], replies: { count: 0, casts: [] }, reactions: { likes_count: 0, recasts_count: 0 } });

test('parent/quoted links preserve feed position; Back and Feed retrace and resume detail', async ({ page }) => {
  const feed = Array.from({ length: 22 }, (_, index) => ({ ...card(`0x${String(index).padStart(40, '0')}`, `Feed cast ${index}: ${'A long test post to make the feed scroll. '.repeat(5)}`), ...(index === 16 ? { parent_hash: parent } : {}) }));
  await page.route('**/api/feed?**', route => route.fulfill({ json: { data: feed, cursor: null } }));
  await page.route('**/api/cast?**', route => {
    const hash = new URL(route.request().url()).searchParams.get('hash');
    const cast = hash === parent ? { ...card(parent, 'Parent conversation'), embeds: [{ url: `https://warpcast.com/~/conversations/${quoted}` }] }
      : card(quoted, 'Quoted conversation');
    return route.fulfill({ json: { cast } });
  });
  await page.goto('/feed', { waitUntil: 'domcontentloaded' });
  const original = page.locator(`[data-feed-cast-hash="${feed[16].hash}"]`);
  const parentLink = original.locator(`a[href="/cast/${parent}"]`);
  await parentLink.scrollIntoViewIfNeeded();
  await expect(parentLink).toBeVisible();
  const before = await original.evaluate(node => node.getBoundingClientRect().top);
  await parentLink.click();
  await expect(page).toHaveURL(`/cast/${parent}`);
  await page.locator(`a[href="/cast/${quoted}"]`).click();
  await expect(page).toHaveURL(`/cast/${quoted}`);
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await expect(page).toHaveURL(`/cast/${parent}`);
  await page.getByRole('link', { name: 'Feed', exact: true }).click();
  await expect(page).toHaveURL('/feed');
  await expect.poll(() => original.evaluate((node, expected) => Math.abs(node.getBoundingClientRect().top - expected), before)).toBeLessThan(8);
  await parentLink.click();
  await expect(page).toHaveURL(`/cast/${parent}`);
  await page.getByRole('link', { name: 'Cast', exact: true }).click();
  await expect(page).toHaveURL('/compose');
  await page.getByRole('link', { name: 'Feed', exact: true }).click();
  await expect(page).toHaveURL(`/cast/${parent}`);
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await expect(page).toHaveURL('/feed');
});

test('native Back and Forward retain the detail scroll position', async ({ page }) => {
  await page.route('**/api/cast?**', route => {
    const hash = new URL(route.request().url()).searchParams.get('hash')!;
    return route.fulfill({ json: { cast: { ...card(hash, 'Thread body '.repeat(400)), embeds: hash === parent ? [{ url: `https://warpcast.com/~/conversations/${quoted}` }] : [] } } });
  });
  await page.goto(`/cast/${parent}`, { waitUntil: 'domcontentloaded' });
  const link = page.locator(`a[href="/cast/${quoted}"]`);
  await link.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => Math.max(window.scrollY, document.body.scrollTop));
  await link.click();
  await expect(page).toHaveURL(`/cast/${quoted}`);
  await page.goBack();
  await expect(page).toHaveURL(`/cast/${parent}`);
  await expect.poll(() => page.evaluate(() => Math.max(window.scrollY, document.body.scrollTop))).toBeGreaterThan(before - 20);
  await page.goForward();
  await expect(page).toHaveURL(`/cast/${quoted}`);
});
