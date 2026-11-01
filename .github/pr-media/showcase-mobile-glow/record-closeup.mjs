import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const require = createRequire(new URL('../../../apps/leclap-web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const work = path.resolve(process.argv[2] ?? '/tmp/leclap-glow-closeup');
await mkdir(path.join(work, 'raw'), { recursive: true });
const content = JSON.parse(await readFile(new URL('./content.json', import.meta.url), 'utf8'));
content.clipSeconds = 8;
content.summary = 'The same mobile scroll gesture: drifting before, stable after.';
content.outro.subtitle = 'The page stays 390 px wide. The glow keeps moving.';
const measurements = {};
const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH });
try {
  for (const [index, side] of ['before', 'after'].entries()) {
    const url = process.env[index === 0 ? 'BEFORE_URL' : 'AFTER_URL'];
    if (!url) throw new Error('Set both build URLs');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      recordVideo: { dir: path.join(work, 'raw'), size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();
    const start = Date.now();
    await page.goto(`${url}/es/showcase`);
    await expect(page.locator('.showcase-page .will-change-\\[transform\\,opacity\\]').first()).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.showcase-feature').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    await page.evaluate(() =>
      window.scrollTo(0, document.querySelector('.showcase-feature').getBoundingClientRect().top + scrollY - 76)
    );
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const animation = document
        .querySelector('.showcase-feature .animate-aurora')
        .getAnimations()
        .find((a) => a instanceof CSSAnimation);
      animation.currentTime = Number(animation.effect.getTiming().duration) * 0.35;
      const label = document.createElement('div');
      label.id = 'qa-width';
      label.style.cssText =
        'position:fixed;top:306px;left:8px;right:8px;z-index:99999;background:#141416;color:#f7f7f8;padding:6px 8px;font:14px/20px monospace;border:1px solid #9298fb;white-space:pre';
      document.body.append(label);
      let maxWidth = innerWidth;
      let maxScroll = 0;
      const update = () => {
        maxWidth = Math.max(maxWidth, document.documentElement.scrollWidth);
        maxScroll = Math.max(maxScroll, scrollX);
        label.dataset.maxWidth = maxWidth;
        label.dataset.maxScroll = maxScroll;
        label.textContent = `QA · ${innerWidth}px viewport · ${document.documentElement.scrollWidth}px page\nHorizontal movement: ${Math.round(scrollX)}px`;
        requestAnimationFrame(update);
      };
      update();
    });
    content.sides[index].trim = (Date.now() - start) / 1000;
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo({ left: 100, top: scrollY, behavior: 'smooth' }));
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(work, `${side}-proof.png`),
      clip: { x: 0, y: 70, width: 390, height: 292 },
    });
    await page.evaluate(() => window.scrollTo({ left: 0, top: scrollY, behavior: 'smooth' }));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo({ left: 100, top: scrollY, behavior: 'smooth' }));
    await page.waitForTimeout(1500);
    measurements[side] = await page
      .locator('#qa-width')
      .evaluate((el) => ({ maxWidth: Number(el.dataset.maxWidth), maxScroll: Number(el.dataset.maxScroll) }));
    await page.evaluate(() => window.scrollTo({ left: 0, top: scrollY, behavior: 'smooth' }));
    await page.waitForTimeout(2500);
    const video = page.video();
    await context.close();
    const raw = path.join(work, 'raw', `${side}.webm`);
    await video.saveAs(raw);
    // Crop the real mobile player, then enlarge it to fill the house template's 4:3 pane.
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        raw,
        '-vf',
        'crop=390:292:0:70,scale=1024:768',
        '-an',
        '-c:v',
        'libx264',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        path.join(work, 'raw', `${side}-closeup.mp4`),
      ],
      { stdio: 'ignore' }
    );
    content.sides[index].capture = `raw/${side}-closeup.mp4`;
    content.sides[index].pane.title = `${measurements[side].maxWidth}px page / 390px screen`;
    content.sides[index].pane.desc =
      side === 'before'
        ? 'The page slides sideways when the glow expands.'
        : 'The same scroll attempt cannot move the page sideways.';
  }
} finally {
  await browser.close();
}
await writeFile(path.join(work, 'content.json'), JSON.stringify(content, null, 2) + '\n');
await writeFile(path.join(work, 'measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
console.log(measurements);
