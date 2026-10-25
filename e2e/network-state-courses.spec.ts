import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`balanced course opens from the catalog and reaches its quiz at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/learn/network-states');
    await expect(page.getByRole('heading', { name: 'Network States: examine the idea.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take the interactive course' })).toHaveCount(4);
    await page.getByRole('link', { name: 'Read course and sources →' }).first().click();
    await expect(page.getByRole('heading', { name: 'Can an Online Community Become a Country?' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Vitalik Buterin/ })).toHaveAttribute('href', 'https://vitalik.eth.limo/general/2022/07/13/networkstates.html');

    const planResponse = page.waitForResponse(response => response.url().includes('/api/learning-plan') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Take the interactive course' }).click();
    expect((await planResponse).status()).toBe(200);
    await expect(page).toHaveURL(/learn\/module\?id=network-states-foundations/);
    await expect(page.getByRole('link', { name: 'Course sources ↗' })).toBeVisible();
    await expect(page.getByText(/Could people meet online/)).toBeVisible();

    // Follow real cards, without seeding cached content or mocking the lesson API.
    for (let step = 0; step < 30; step++) {
      if (await page.getByText('Question 1 of 3', { exact: true }).isVisible()) break;
      const next = page.getByRole('button', { name: 'Continue →', exact: true });
      await expect(next).toBeEnabled();
      await next.click();
    }
    await expect(page.getByText('Question 1 of 3', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /An online startup society/ }).click();
    await page.getByRole('button', { name: /Check/ }).click();
    await expect(page.getByText(/The roadmap begins with an online startup society/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('hh_learning_plan') || '{}'));
    expect(plan.modules).toHaveLength(4);
  });
}

test('course start surfaces a failure and can be retried without clearing progress', async ({ page }) => {
  await page.goto('/learn/network-states');
  await page.evaluate(() => localStorage.setItem('hh_learning_progress', JSON.stringify(['existing-completed-course'])));
  await page.route('**/api/learning-plan', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Could not prepare your course progress. Please try again.' }) }));
  const start = page.getByRole('button', { name: 'Take the interactive course' }).first();
  await start.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please try again' })).toBeVisible();
  await expect(start).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hh_learning_progress') || '[]'))).toEqual(['existing-completed-course']);
  await page.unroute('**/api/learning-plan');
  await start.click();
  await expect(page).toHaveURL(/learn\/module\?id=network-states-foundations/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hh_learning_progress') || '[]'))).toEqual(['existing-completed-course']);
});
