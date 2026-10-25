import { test, expect } from '@playwright/test';

for (const width of [390, 820, 1280]) {
  test(`conversation explanation and focused lesson at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, 'serviceWorker');
      localStorage.setItem('hh_migration_guide_v1', 'dismissed');
    });
    const origin = new URL(baseURL || 'http://localhost:3000').origin;
    const requests: any[] = [];
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/ask-homie' && route.request().method() === 'POST') {
        requests.push(route.request().postDataJSON());
        return route.fulfill({ json: { response: requests.at(-1).learningMode === 'lesson' ? '# Your encryption lesson\nAn exercise and understanding check.' : 'Encryption keeps readable messages private.', agentRole: 'researcher', metadata: { learningMode: requests.at(-1).learningMode, sources: [], liveCastSearch: { resultCount: 1, status: 'searched', citations: [{ url: '/cast/0x' + 'b'.repeat(40), username: 'source-author', text: 'A related public discussion about key recovery.' }] } } } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { data: [], profile: null, stats: {}, channels: [], notifications: [] } });
      return route.continue();
    });
    const cast = { hash: '0x' + 'a'.repeat(40), text: '100% private? 🔑', author: { username: 'alice' } };
    await page.goto(`/ask-homie?${new URLSearchParams({ cast: JSON.stringify(cast), learning: 'explain' })}`);
    await expect(page.getByText('Encryption keeps readable messages private.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '@source-author: A related public discussion about key recovery.' })).toHaveAttribute('href', '/cast/0x' + 'b'.repeat(40));
    await expect(page.getByText('Related casts · 1 retrieved from Hypersnap')).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].castContext.text).toBe(cast.text);
    await page.getByLabel('Topic or question (optional)').fill('Key recovery');
    await page.getByRole('button', { name: 'Build me a lesson', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your encryption lesson' })).toBeVisible();
    expect(requests[1].learningMode).toBe('lesson');
    expect(requests[1].learningTopic).toBe('Key recovery');
    expect(requests[1].messages.some((message: any) => message.content.includes('readable messages'))).toBe(true);
    const input = page.getByPlaceholder('Auto-detect what I need...');
    await input.fill('What if I lose my phone?');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect.poll(() => requests.length).toBe(3);
    expect(requests[2].learningMode).toBe('lesson');
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByText('What if I lose my phone?', { exact: true })).toBeVisible();
    expect(requests).toHaveLength(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
