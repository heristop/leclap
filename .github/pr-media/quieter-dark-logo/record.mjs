import { createRequire } from 'node:module';
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(resolve('apps/leclap-web/package.json'));
const { chromium } = require('@playwright/test');
const out = resolve(process.env.CAPTURE_DIR ?? 'build/logo-evidence/raw');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
for (const [side, port] of [
  ['before', 5186],
  ['after', 5187],
]) {
  if (process.env.CAPTURE_SIDE && process.env.CAPTURE_SIDE !== side) continue;
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      recordVideo: { dir: out, size: { width: 1024, height: 768 } },
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/about`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'About LeClap', exact: true }).waitFor();
    await page.screenshot({ path: resolve(out, `${side}-${width}-light.png`) });
    await page.getByRole('button', { name: /switch to dark/i }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(out, `${side}-${width}-dark.png`) });
    if (side === 'after') {
      const paint = await page
        .locator('.logo-mark')
        .first()
        .evaluate((e) => getComputedStyle(e).getPropertyValue('--logo-disc-start').trim());
      if (paint !== '#343151') throw Error(`Unexpected dark paint: ${paint}`);
      const end = await page
        .locator('.logo-mark')
        .first()
        .evaluate((e) => getComputedStyle(e).getPropertyValue('--logo-disc-end').trim());
      if (end !== '#442b3a') throw Error(`Unexpected gradient end: ${end}`);
      const ring = await page
        .locator('.logo-mark > circle')
        .first()
        .evaluate((e) => getComputedStyle(e).strokeWidth);
      if (ring !== '28px') throw Error(`Unexpected ring width: ${ring}`);
    }
    await page.waitForTimeout(4500);
    await context.close();
    await copyFile(await page.video().path(), resolve(out, `${side}-${width}.webm`));
    console.log(`Captured ${side} ${width}: light and dark`);
  }
}
await browser.close();
