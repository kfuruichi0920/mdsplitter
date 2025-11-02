import { expect, test } from '@playwright/test';

test('inline HTML smoke test', async ({ page }) => {
  await page.goto('data:text/html,<h1>mdsplitter</h1>');
  await expect(page.locator('h1')).toHaveText('mdsplitter');
});
