import { test, expect } from '@playwright/test';

for (const width of [390, 820]) {
  test(`attack-cost animation explains the card at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, 'serviceWorker');
      localStorage.setItem('hh_migration_guide_v1', 'dismissed');
      localStorage.setItem('hh_learning_plan', JSON.stringify({ modules: [{ id: 'attack-cost', title: 'Blockchain basics', description: 'Economics', whyItMatters: 'Understand incentives.', objectives: ['Compare cost and reward'], tags: [], difficulty: 'beginner', estimatedMinutes: 5 }] }));
      localStorage.setItem('hh_learning_progress', '["previous-module"]');
      localStorage.setItem('hh_lesson_position:attack-cost', '2');
    });
    const origin = new URL(baseURL || 'http://localhost:3000').origin;
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/lesson') return route.fulfill({ json: {
        intro: 'Study attack costs.', concepts: [{ title: 'Double-spending and proof-of-work', explanation: 'This is game theory: the cost of attacking the chain exceeds the reward.' }],
        practicalExample: 'Compare the incentive.', quickActions: ['Compare the cost with the reward.'], summary: 'Consider incentives.',
        quiz: [{ question: 'What exceeds the reward?', options: ['Attack cost', 'Nothing'], correctIndex: 0, explanation: 'The cost.' }],
      } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { plan: null, channels: [], users: [], data: [] } });
      return route.continue();
    });
    await page.goto('/learn/module?id=attack-cost');
    const animation = page.getByRole('region', { name: 'Animated explanation' });
    await expect(animation).toBeVisible();
    const cost = animation.locator('[data-actor="cost"] > div');
    await expect(cost).toHaveCSS('height', '25px');
    await animation.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(cost).toHaveCSS('height', '75px');
    await animation.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(cost).toHaveCSS('height', '125px');
    await expect(animation.getByText('In the situation this card describes, the attack cost exceeds the possible reward.')).toBeVisible();
    await animation.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(animation.getByRole('button', { name: 'Replay' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('hh_learning_progress'))).toBe('["previous-module"]');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = await animation.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  });
}
