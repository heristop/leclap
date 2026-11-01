import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(new URL('../../../apps/leclap-web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const work = path.resolve(process.argv[2] ?? '/tmp/leclap-marketing-evidence');
const urls = [process.env.BEFORE_URL, process.env.AFTER_URL];
if (urls.some((url) => !url)) throw new Error('Set BEFORE_URL and AFTER_URL to the real builds.');
await mkdir(path.join(work, 'raw'), { recursive: true });
const content = JSON.parse(await readFile(new URL('./content.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH });
try {
  for (const [index, side] of ['before', 'after'].entries()) {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      javaScriptEnabled: false,
      recordVideo: { dir: path.join(work, 'raw'), size: { width: 1024, height: 768 } },
    });
    const page = await context.newPage();
    const start = Date.now();
    await page.goto(`${urls[index]}/fr/about`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    content.sides[index].trim = (Date.now() - start) / 1000;
    await page.waitForTimeout(5000);
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(work, 'raw', `${side}.webm`));
    for (const [name, viewport] of Object.entries({
      desktop: { width: 1440, height: 900 },
      mobile: { width: 390, height: 844 },
    })) {
      const stillContext = await browser.newContext({ viewport, deviceScaleFactor: 2, javaScriptEnabled: false });
      const still = await stillContext.newPage();
      await still.goto(`${urls[index]}/fr/about`, { waitUntil: 'load' });
      await still.evaluate(() => document.fonts.ready);
      await still.waitForTimeout(1000);
      await still.screenshot({ path: path.join(work, `${side}-${name}.png`) });
      await stillContext.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(path.join(work, 'content.json'), `${JSON.stringify(content, null, 2)}\n`);
