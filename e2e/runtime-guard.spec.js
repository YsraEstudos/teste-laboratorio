import { test } from './fixtures/runtime-guard.js';

test.use({
  expectedRuntimeIssues: ['console.error: runtime-guard-probe'],
});

test('runtime guard records console.error signals', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    console.error('runtime-guard-probe');
  });
});
