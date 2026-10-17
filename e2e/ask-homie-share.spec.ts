import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

test('long Ask Homie share posts as a thread and Back restores the search', async ({ page, baseURL }) => {
  const origin = new URL(baseURL || 'http://localhost:3000').origin;
  await page.addInitScript(() => {
    Reflect.deleteProperty(Navigator.prototype, 'serviceWorker');
    localStorage.setItem('hh_profile', JSON.stringify({ fid: 321, username: 'fixture' }));
    localStorage.setItem('signer_321', JSON.stringify({ status: 'approved', private_key: '01'.repeat(32) }));
  });
  const answer = 'Research results from the fixture. ' + 'é🏠 '.repeat(250);
  const submitted: Buffer[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/ask-homie') return route.fulfill({ json: route.request().method() === 'POST' ? { response: answer, agentRole: 'researcher' } : { profile: null, stats: {} } });
    if (url.pathname === '/api/submit-cast') {
      submitted.push(route.request().postDataBuffer()!);
      return route.fulfill({ json: { ok: true, hash: '0x' + String(submitted.length).repeat(40) } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { data: [], channels: [], notifications: [] } });
    return route.continue();
  });

  const source = { hash: '0x' + 'c'.repeat(40), author: { username: 'source' }, text: 'Original cast' };
  await page.goto(`/ask-homie?cast=${encodeURIComponent(JSON.stringify(source))}`);
  const input = page.getByPlaceholder('Auto-detect what I need...');
  await input.fill('Search OpenCast');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('Research results from the fixture.', { exact: false }).first()).toBeVisible();
  await input.fill('My follow-up draft');
  await page.getByRole('button', { name: 'Share as Cast', exact: true }).last().click();
  await expect(page.getByRole('button', { name: /Post thread/ })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Ask Homie', exact: true }).click();
  await expect(page.getByText('Search OpenCast', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('My follow-up draft');
  await page.getByRole('button', { name: 'Share as Cast', exact: true }).last().click();
  await page.getByRole('button', { name: /Post thread/ }).click();
  await expect(page.getByText('Search OpenCast', { exact: true })).toBeVisible();
  expect(submitted.length).toBeGreaterThan(1);
  await expect(input).toHaveValue('My follow-up draft');
});
