import { test, expect } from '@playwright/test';

const firstHash = '0x' + 'a'.repeat(40);
const otherHash = '0x' + 'b'.repeat(40);
const author = { fid: 321, username: 'navigationtest', display_name: 'Navigation Test' };
const cast = (hash: string) => ({ hash, text: 'Home preview ' + hash, author, timestamp: '2026-10-17T12:00:00Z', embeds: [], reactions: {}, replies: { count: 0, casts: [] } });

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1280, height: 800 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport, serviceWorkers: 'block' });

    test('Home feed preview Back opens Following; header/sidebar and drawer Feed open the full feed', async ({ page }) => {
      let homeReads = 0;
      let replaceHomeCards = false;
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://localhost:3000') return route.abort();
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
        return route.continue();
      });
      await page.addInitScript(() => {
        localStorage.setItem('hh_profile', JSON.stringify({ fid: 321, username: 'navigationtest' }));
        sessionStorage.setItem('hh_session_v1', JSON.stringify({ fid: 321, expiresAt: Date.now() + 3600000 }));
        sessionStorage.setItem('hh_feed_return_v2', JSON.stringify({
          snapshotKey: 'hh_feed_snapshot_v2:321:global:all', owner: '321', feedType: 'global',
          selectedChannel: null, castHash: 'stale', castOffset: null, scrollY: 0, ts: Date.now(),
        }));
        localStorage.setItem('hh_migration_guide_v1', 'dismissed');
      });
      await page.route('**/api/learning-progress?**', route => route.fulfill({ json: {
        hh2_points: 700, plan: { summary: 'Learning summary. '.repeat(50), modules: [] },
      } }));
      await page.route('**/api/feed?**', route => {
        const isHome = new URL(route.request().url()).searchParams.get('limit') === '4';
        if (isHome) homeReads++;
        return route.fulfill({ json: { data: [cast(replaceHomeCards && isHome ? otherHash : firstHash)], cursor: null } });
      });
      await page.route('**/api/cast?**', route => route.fulfill({ json: { cast: { ...cast(firstHash), text: 'Conversation body. '.repeat(80) } } }));
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const anchor = page.locator(`[data-feed-cast-hash="${firstHash}"]`);
      await expect(anchor).toBeVisible();
      await anchor.scrollIntoViewIfNeeded();
      const reads = homeReads;
      replaceHomeCards = true;
      await anchor.click();
      await expect(page).toHaveURL(`/cast/${firstHash}?returnTo=%2Ffeed%3Ffeed_type%3Dfollowing`);
      await page.getByRole('button', { name: '← Back', exact: true }).click();
      await expect(page).toHaveURL('/feed?feed_type=following');
      await expect(page.getByRole('button', { name: 'Following', exact: true })).toHaveAttribute('aria-pressed', 'true');
      expect(homeReads, 'returning to the full feed must not refetch the Home preview').toBe(reads);
      if (viewport.width < 1024) {
        await page.getByRole('button', { name: 'Open menu' }).click();
        await page.getByRole('link', { name: 'Feed', exact: true }).filter({ visible: true }).last().click();
        await expect(page.getByRole('button', { name: 'Close menu' })).toBeHidden();
        await expect(page).toHaveURL('/feed');
      }
    });
  });
}
