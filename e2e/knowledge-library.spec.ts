import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`reading catalog and interactive course at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('hh_migration_guide_v1', 'true'));
    await page.goto('/learn/library');
    await page.getByRole('button', { name: 'Creator economy', exact: true }).click();
    await expect(page.getByRole('link', { name: /Creator Coins: Supporting/ })).toBeVisible();
    await page.getByRole('combobox', { name: 'Difficulty', exact: true }).selectOption('advanced');
    await expect(page.getByRole('status')).toHaveText('1 courses');
    await page.getByRole('link', { name: /Creator Coins: Supporting/ }).click();
    await expect(page.getByRole('heading', { name: 'Sources and further reading' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Zora: Coins Protocol/ })).toHaveAttribute('href', 'https://docs.zora.co/coins');
    await page.getByRole('button', { name: 'Take the interactive course' }).click();
    await expect(page).toHaveURL(/learn\/module\?id=creator-coins-and-incentives/);
    await expect(page.getByRole('link', { name: /Course sources/ })).toHaveAttribute('href', /creator-coins-and-incentives#sources/);
    for (let step = 0; step < 30; step++) {
      if (await page.getByText('Is one platform’s coin design universal?', { exact: true }).isVisible()) break;
      await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    }
    await expect(page.getByText('Is one platform’s coin design universal?', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^[A-D]No$/ }).click();
    await page.getByRole('button', { name: /Check/ }).click();
    await expect(page.getByText('Implementations and terms differ.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
