import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(new URL('../../../apps/leclap-web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const work = path.resolve(process.argv[2] ?? '/tmp/leclap-watch-evidence');
const urls = [process.env.BEFORE_URL, process.env.AFTER_URL];
if (urls.some((url) => !url)) throw new Error('Set BEFORE_URL and AFTER_URL to the two real builds.');
await mkdir(path.join(work, 'raw'), { recursive: true });
const content = JSON.parse(await readFile(new URL('./content.json', import.meta.url), 'utf8'));
const browser = await chromium.launch();
try {
  for (const [index, side] of ['before', 'after'].entries()) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
      colorScheme: 'light',
      recordVideo: { dir: path.join(work, 'raw'), size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    const start = Date.now();
    await page.goto(`${urls[index]}/showcase/type-impact`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Download editable JSON', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    content.sides[index].trim = (Date.now() - start) / 1000;
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(work, `${side}.png`) });
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(work, 'raw', `${side}.webm`));
  }
} finally {
  await browser.close();
}
await writeFile(path.join(work, 'content.json'), `${JSON.stringify(content, null, 2)}\n`);
console.log('Inspect the recordings and verify trim positions before running the house renderer.');
