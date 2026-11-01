import { test, expect } from '@playwright/test';

// Run against the production preview: E2E_PRERENDER=1 E2E_BASE_URL=http://localhost:5413.
// The dev server intentionally has no build-time HTML.
test('production guides are readable and navigable without JavaScript', async ({ browser, baseURL }) => {
  test.skip(process.env.E2E_PRERENDER !== '1', 'Requires the production preview with prerendered HTML');
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: 'reduce',
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('/doc');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'AI motion graphics guide', exact: true }).click();
  await expect(page).toHaveURL(/\/doc\/agents$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('AI motion graphics with MCP and JSON');
  await expect(page.getByRole('heading', { name: 'Connect through MCP', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'CLI reference', exact: true })).toHaveAttribute(
    'href',
    'https://leclap.dev/doc/cli'
  );
  await page.goto('/doc/cli');
  await expect(page).toHaveURL(/\/doc\/cli$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Command line');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});

test('client mount preserves guide content and contextual navigation', async ({ page }) => {
  await page.goto('/doc/mcp');
  await page.getByRole('link', { name: 'AI motion graphics walkthrough', exact: true }).click();
  await expect(page).toHaveURL(/\/doc\/agents$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Connect through MCP', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Copy page/i })).toBeVisible();
});
