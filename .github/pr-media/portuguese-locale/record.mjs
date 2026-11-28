// Before/after captures for the Portuguese locale. Before = merge base on BEFORE_PORT, after = branch on
// AFTER_PORT, both Vite dev servers. Writes raw PNGs and WebM captures to build/pr/portuguese-locale.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const require = createRequire(path.join(root, 'apps/leclap-web/package.json'));
const { chromium } = require('@playwright/test');
const out = path.join(root, 'build/pr/portuguese-locale');
await mkdir(out, { recursive: true });

const sides = [
  ['before', Number(process.env.BEFORE_PORT ?? 5531)],
  ['after', Number(process.env.AFTER_PORT ?? 5532)],
];
const browser = await chromium.launch({ headless: true });
const report = [];

const settle = async (page) => {
  await page.locator('h1').first().waitFor({ timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
};

const visibleMenu = (page) => page.getByRole('menu').filter({ visible: true }).first();

const openMenu = async (page) => {
  await page.getByRole('button', { name: 'Change language' }).first().click();
  await visibleMenu(page).waitFor();
  await page.waitForTimeout(600);
};

for (const [side, port] of sides) {
  const base = `http://127.0.0.1:${port}`;

  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
        colorScheme: theme,
      });
      await context.addInitScript((value) => {
        localStorage.setItem('leclap-theme', value);
        localStorage.setItem('leclap-lang-suggested', '1');
      }, theme);
      const page = await context.newPage();
      page.on('pageerror', (e) => report.push({ side, width, theme, error: e.message }));

      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await settle(page);
      await openMenu(page);
      const items = await visibleMenu(page).getByRole('menuitem').allInnerTexts();
      await page.screenshot({ path: `${out}/${side}-menu-${width}-${theme}.png` });

      await page.goto(`${base}/pt`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await settle(page);
      await page.screenshot({ path: `${out}/${side}-pt-${width}-${theme}.png` });
      report.push({
        side,
        width,
        theme,
        menu: items.map((s) => s.trim()),
        ptLang: await page.evaluate(() => document.documentElement.lang),
        ptH1: (await page.locator('h1').first().innerText()).replace(/\s+/g, ' '),
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      });
      await context.close();
    }
  }

  // The flow the evidence video is built from: home, open the picker, go to /pt.
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
    recordVideo: { dir: out, size: { width: 1024, height: 768 } },
  });
  await context.addInitScript(() => {
    localStorage.setItem('leclap-theme', 'light');
    localStorage.setItem('leclap-lang-suggested', '1');
  });
  const t0 = Date.now();
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(page);
  await page.waitForTimeout(1000);
  const menuAt = (Date.now() - t0) / 1000;
  await openMenu(page);
  await page.waitForTimeout(1800);
  const navAt = (Date.now() - t0) / 1000;
  const portuguese = page.getByRole('menuitem', { name: /Português/ });
  if (await portuguese.count()) {
    await portuguese.first().click();
  }
  if (!(await portuguese.count())) {
    await page.goto(`${base}/pt`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  }
  await settle(page);
  const landedAt = (Date.now() - t0) / 1000;
  await page.waitForTimeout(4000);
  report.push({ side, video: true, menuAt, navAt, landedAt, url: page.url() });
  await context.close();
  await page.video().saveAs(`${out}/${side}.webm`);
}

await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
