import { test, expect } from '@playwright/test';

for (const javaScriptEnabled of [false, true]) {
  test(`showcase contains its animated glow with JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await page.goto('/es/showcase');
    await page.evaluate(() => document.fonts.ready);
    const glow = page.locator('.showcase-feature .animate-aurora');
    await page.locator('.showcase-feature').scrollIntoViewIfNeeded();
    if (javaScriptEnabled) await expect(glow).toHaveCSS('opacity', '1');
    await expect(glow).toHaveCSS('animation-name', 'aurora-drift');
    await expect(glow).toHaveCSS('animation-play-state', 'running');

    for (const width of [320, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      // Sample the full animation cycle deterministically, including its widest transform.
      const widths = await glow.evaluate((element) => {
        const animation = element.getAnimations().find((item) => item instanceof CSSAnimation);
        if (!animation) throw new Error('Expected a running glow animation');
        const duration = Number(animation.effect!.getTiming().duration);
        animation.pause();
        const measurements = [];
        for (let step = 0; step <= 24; step++) {
          animation.currentTime = (duration * step) / 24;
          measurements.push(document.documentElement.scrollWidth);
        }
        animation.play();
        return measurements;
      });
      expect(Math.max(...widths), `${width}px viewport`).toBeLessThanOrEqual(width);
    }
    await expect(glow).toHaveCSS('animation-play-state', 'running');
    await context.close();
  });
}
