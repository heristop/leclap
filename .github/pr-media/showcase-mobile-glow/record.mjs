import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(new URL('../../../apps/leclap-web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const work = path.resolve(process.argv[2] ?? '/tmp/leclap-glow-evidence');
const content = JSON.parse(await readFile(new URL('./content.json', import.meta.url), 'utf8'));
await mkdir(path.join(work, 'raw'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH });
async function prepare(page, url) {
  await page.goto(`${url}/es/showcase`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.showcase-feature').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
  await page.evaluate(() =>
    window.scrollTo(0, document.querySelector('.showcase-feature').getBoundingClientRect().top + scrollY - 100)
  );
  await page.waitForTimeout(500);
}
try {
  for (const [index, side] of ['before', 'after'].entries()) {
    const url = process.env[index === 0 ? 'BEFORE_URL' : 'AFTER_URL'];
    if (!url) throw new Error('Set BEFORE_URL and AFTER_URL');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      recordVideo: { dir: path.join(work, 'raw'), size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();
    const start = Date.now();
    await prepare(page, url);
    // Clearly labelled QA instrumentation, not part of the application.
    await page.evaluate(() => {
      const glow = document.querySelector('.showcase-feature .animate-aurora');
      const animation = glow.getAnimations().find((item) => item instanceof CSSAnimation);
      animation.currentTime = Number(animation.effect.getTiming().duration) * 0.25;
      let maximum = innerWidth;
      const label = document.createElement('div');
      label.style.cssText =
        'position:fixed;bottom:12px;left:12px;right:12px;z-index:99999;background:#141416;color:#f7f7f8;padding:12px;font:14px monospace;border:1px solid #9298fb';
      document.body.append(label);
      const update = () => {
        maximum = Math.max(maximum, document.documentElement.scrollWidth);
        label.textContent = `QA: viewport ${innerWidth}px / max page ${maximum}px`;
        requestAnimationFrame(update);
      };
      update();
    });
    content.sides[index].trim = (Date.now() - start) / 1000;
    await page.waitForTimeout(11000);
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(work, 'raw', `${side}.webm`));
    for (const theme of process.env.VIDEO_ONLY ? [] : ['light', 'dark']) {
      for (const [name, viewport] of Object.entries({
        mobile: { width: 390, height: 844 },
        desktop: { width: 1440, height: 900 },
      })) {
        const stillContext = await browser.newContext({
          viewport,
          deviceScaleFactor: 2,
          colorScheme: theme,
          reducedMotion: 'no-preference',
        });
        const still = await stillContext.newPage();
        await prepare(still, url);
        await still.screenshot({ path: path.join(work, `${side}-${name}-${theme}.png`) });
        await stillContext.close();
      }
    }
  }
} finally {
  await browser.close();
}
await writeFile(path.join(work, 'content.json'), `${JSON.stringify(content, null, 2)}\n`);
