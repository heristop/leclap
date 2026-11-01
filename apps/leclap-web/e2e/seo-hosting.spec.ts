import { test, expect } from '@playwright/test';

test.describe('Cloudflare Pages SEO responses', () => {
  test.skip(process.env.E2E_PAGES !== '1', 'Requires pnpm preview:pages after a production build');
  test('serves real 404s, permanent redirects, and noindex editor shells', async ({ request }) => {
    for (const path of ['/missing-seo-test', '/showcase/not-a-sample', '/templates/a/edit/extra']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      expect(await response.text()).toContain('noindex');
    }
    for (const path of ['/doc/cli', '/fr', '/showcase/type-impact', '/studio']) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
    const redirect = await request.get('/docs/cli?source=old', { maxRedirects: 0 });
    expect(redirect.status()).toBe(301);
    expect(redirect.headers().location).toContain('/doc/cli?source=old');
    for (const path of ['/templates', '/fr/templates/abc/edit', '/studio/new', '/de/partials']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['x-robots-tag']).toContain('noindex');
      expect(response.headers()['cross-origin-embedder-policy']).toBe('require-corp');
      expect(await response.text()).toContain('content="noindex, follow"');
    }
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('<lastmod>');
    expect(sitemap).toContain('<loc>https://leclap.dev/showcase/type-impact</loc>');
    expect(sitemap).not.toContain('<loc>https://leclap.dev/templates');
    const range = await request.get('/videos/showcase/type-impact.mp4', { headers: { Range: 'bytes=0-99' } });
    // Wrangler's local asset cache may return the full file; the handler unit test
    // separately verifies that Range requests and 206 responses pass through unchanged.
    expect([200, 206]).toContain(range.status());
    expect(range.headers()['content-type']).toContain('video/mp4');
    const bytes = await range.body();
    if (range.status() === 206) expect(bytes.length).toBe(100);
    else expect(bytes.length).toBeGreaterThan(100);
  });

  test('mobile watch page works without JavaScript', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      reducedMotion: 'reduce',
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto('/doc/examples');
    await page.getByRole('link', { name: 'Animated titles with JSON and FFmpeg', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Animated titles with JSON and FFmpeg');
    await expect(page.locator('video')).toHaveAttribute('controls', '');
    await expect(page.getByRole('link', { name: 'Download editable JSON' })).toHaveAttribute(
      'href',
      '/videos/showcase/type-impact.json'
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await context.close();
  });

  test('watch page retains the branded player after client mount', async ({ page }) => {
    await page.goto('/showcase/type-impact');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Animated titles with JSON and FFmpeg');
    await expect(page.locator('video source[type="video/mp4"]')).toHaveAttribute(
      'src',
      '/videos/showcase/type-impact.mp4'
    );
    await page.getByRole('button', { name: 'Watch Type impact', exact: true }).first().click();
    await expect
      .poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime))
      .toBeGreaterThan(0);
    await page.getByRole('link', { name: 'JSON motion graphics with animated HTML cards', exact: true }).click();
    await expect(page).toHaveURL(/\/showcase\/html-motion$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
});
