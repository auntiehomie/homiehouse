import { test, expect } from '@playwright/test';

test('AI catalog selection is not overwritten by a late saved path', async ({ page }) => {
  let release!: () => void;
  const waitForSelection = new Promise<void>(resolve => { release = resolve; });
  await page.addInitScript(() => {
    localStorage.setItem('hh_profile', JSON.stringify({ fid: 321, username: 'test' }));
    localStorage.setItem('hh_learning_plan', JSON.stringify({ track: 'decentralization', level: 'beginner', summary: 'Old path', modules: [] }));
    localStorage.setItem('hh_learning_progress', JSON.stringify(['old-completed']));
    localStorage.setItem('hh_migration_guide_v1', 'dismissed');
  });
  await page.route('**/api/learning-progress?**', async route => {
    await waitForSelection;
    await route.fulfill({ json: { found: true, plan: { track: 'decentralization', level: 'beginner', summary: 'Old path', modules: [] }, completed_ids: ['old-completed'] } });
  });
  await page.goto('/learn');
  const ai = page.locator('article').filter({ has: page.getByRole('heading', { name: 'AI', exact: true }) });
  await ai.getByRole('button', { name: 'beginner', exact: true }).click();
  release();
  await expect(page.getByRole('heading', { name: "What's your main goal right now?" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate My Plan' })).toBeVisible();
});
