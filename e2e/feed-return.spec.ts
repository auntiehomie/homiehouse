import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const targetHash = '0x' + 'c'.repeat(40);
const author = { fid: 321, username: 'navigationtest', display_name: 'Navigation Test' };
const casts = Array.from({ length: 20 }, (_, index) => ({
  hash: index === 4 ? targetHash : `0x${String(index).padStart(40, '0')}`,
  text: index === 4 ? 'Target long cast. ' + 'A long post that must return to the same paragraph. '.repeat(120) : `Feed post ${index}. ` + 'Keep this exact ordered list. '.repeat(10),
  author, timestamp: '2026-10-17T12:00:00Z', embeds: [], reactions: {}, replies: { count: 0, casts: [] },
}));

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://localhost:3000') return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('hh_profile', JSON.stringify({ fid: 321, username: 'navigationtest' }));
    sessionStorage.setItem('hh_session_v1', JSON.stringify({ fid: 321, expiresAt: Date.now() + 3600000 }));
  });
});

async function fixture(page: Page) {
  let requests = 0;
  await page.route('**/api/feed?**', route => {
    requests++;
    return route.fulfill({ json: { data: casts, cursor: null } });
  });
  await page.route('**/api/cast?**', route => route.fulfill({ json: { cast: casts[4] } }));
  await page.goto('/feed', { waitUntil: 'domcontentloaded' });
  const anchor = page.locator(`[data-feed-cast-hash="${targetHash}"]`);
  await expect(anchor).toContainText('Target long cast.');
  await anchor.scrollIntoViewIfNeeded();
  await page.mouse.move(150, 250);
  await page.mouse.wheel(0, 650);
  await expect.poll(() => anchor.evaluate(node => node.getBoundingClientRect().top)).toBeLessThan(-200);
  const offset = await anchor.evaluate(node => node.getBoundingClientRect().top);
  await page.mouse.click(150, 250);
  await expect(page).toHaveURL(`/cast/${targetHash}`);
  return { anchor, offset, requests: () => requests };
}

async function returnAndCheck(page: Page, state: Awaited<ReturnType<typeof fixture>>) {
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await expect(page).toHaveURL('/feed');
  await expect(state.anchor).toBeAttached();
  expect(state.requests(), 'returning must not fetch a new first page').toBe(1);
  await expect.poll(() => state.anchor.evaluate((node, offset) => Math.abs(node.getBoundingClientRect().top - offset), state.offset)).toBeLessThan(5);
}

test('returns to the same long-cast paragraph with session storage writes blocked, without refetching', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === window.sessionStorage) throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  const state = await fixture(page);
  await returnAndCheck(page, state);
});

test('keeps the loaded feed after reading a detail for longer than the old five-minute cache', async ({ page }) => {
  const state = await fixture(page);
  await page.evaluate(() => {
    const now = Date.now;
    Date.now = () => now() + 45 * 60 * 1000;
  });
  await returnAndCheck(page, state);
});

test('corrects late media layout changes above the saved cast until the user scrolls', async ({ page }) => {
  const state = await fixture(page);
  await returnAndCheck(page, state);
  // Simulate an embed above this post resolving after the initial restore settled.
  await page.waitForTimeout(900);
  await page.locator('[data-feed-cast-hash]').first().evaluate(node => {
    const media = document.createElement('div');
    media.style.height = '480px';
    node.prepend(media);
  });
  await expect.poll(() => state.anchor.evaluate((node, offset) => Math.abs(node.getBoundingClientRect().top - offset), state.offset)).toBeLessThan(5);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => state.anchor.evaluate((node, offset) => Math.abs(node.getBoundingClientRect().top - offset), state.offset)).toBeGreaterThan(100);
  expect(state.requests()).toBe(1);
});

test('a downward touch drag in the middle of the feed does not refresh the feed', async ({ page }) => {
  const state = await fixture(page);
  await returnAndCheck(page, state);
  const touch = async (type: string, y: number) => state.anchor.evaluate((node, args) => {
    const event = new Event(args.type, { bubbles: true });
    Object.defineProperty(event, 'touches', { value: args.type === 'touchend' ? [] : [{ clientY: args.y }] });
    node.dispatchEvent(event);
  }, { type, y });
  await touch('touchstart', 200);
  await touch('touchmove', 320);
  await touch('touchend', 320);
  await page.waitForTimeout(400);
  expect(state.requests(), 'normal scrolling must not be interpreted as pull-to-refresh').toBe(1);
});
