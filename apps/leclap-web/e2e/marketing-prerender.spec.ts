import { test, expect } from '@playwright/test';
import { LOCALE_CODES, LOCALIZED_ROUTES } from '../src/config/site';

test.describe('marketing prerender', () => {
  test.skip(process.env.E2E_PAGES !== '1', 'Requires a production Pages build');

  test('all localized pages ship content with matching language and canonical', async ({ request }) => {
    for (const language of LOCALE_CODES) {
      for (const { path } of LOCALIZED_ROUTES) {
        const url = language === 'en' ? path : `/${language}${path === '/' ? '' : path}`;
        const response = await request.get(url);
        expect(response.status(), url).toBe(200);
        const html = await response.text();
        expect(html).toContain(`<html lang="${language}">`);
        expect(html).toContain(`rel="canonical" href="https://leclap.dev${url}"`);
        expect(html.match(/<h1\b/g), url).toHaveLength(1);
        if (path === '/showcase') expect(html).toMatch(/rel="stylesheet" href="\/assets\/showcase-[^"]+\.css"/);
      }
    }
  });

  test('mobile visitors can read and navigate marketing pages without JavaScript', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    for (const path of ['/', '/fr/about', '/de/compare/remotion', '/es/showcase', '/it/privacy', '/legal', '/studio']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    }
    await page.goto('/fr/about');
    await page.locator('footer a[href="/fr/privacy"]').click();
    await expect(page).toHaveURL(/\/fr\/privacy$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await context.close();
  });

  test('client mount keeps scroll reveals and mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/about');
    // Waiting for this effect-driven state proves the client replaced the static HTML.
    const reveal = page.locator('main .will-change-\\[transform\\,opacity\\]').first();
    await expect(reveal).toHaveCount(1);
    const section = page
      .locator('main .transition-all')
      .filter({ has: page.getByRole('heading', { level: 2 }) })
      .last();
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
