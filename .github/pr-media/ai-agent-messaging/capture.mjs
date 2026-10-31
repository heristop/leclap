import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../../..');
const require = createRequire(path.join(root, 'apps/leclap-web/package.json'));
const { chromium } = require('@playwright/test');
const out = path.join(root, 'build/pr/ai-messaging');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
const versions = process.env.AFTER_ONLY
  ? [['after', 5412]]
  : [
      ['before', 5411],
      ['after', 5412],
    ];
for (const [version, port] of versions) {
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
        colorScheme: theme,
      });
      await context.addInitScript((theme) => {
        localStorage.setItem('leclap-theme', theme);
        localStorage.setItem('leclap-lang', 'en');
      }, theme);
      const page = await context.newPage();
      page.on('pageerror', (e) => report.push({ version, width, error: e.message }));
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.locator('h1').waitFor({ timeout: 90000 });
      await page.waitForTimeout(2000);
      await page.evaluate(() => document.fonts.ready);
      if (!(await page.evaluate(() => document.fonts.check('16px Oswald')))) throw new Error('Missing Oswald font');
      await page.screenshot({ path: `${out}/${version}-${width}-${theme}.png` });
      report.push({
        version,
        width,
        theme,
        headline: await page.locator('h1').innerText(),
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      });
      if (version === 'after') {
        await page.getByRole('button', { name: 'Try it in your browser', exact: true }).click();
        await page.getByRole('dialog').waitFor();
        await page.getByRole('button', { name: 'Render a sample now', exact: true }).waitFor();
        await page.screenshot({ path: `${out}/browser-demo-${width}-${theme}.png` });
        await page.getByRole('button', { name: 'Skip onboarding', exact: true }).click();
        await page.locator('#agent-workflow').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/workflow-${width}-${theme}.png` });
        await page.locator('#features').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/features-${width}-${theme}.png` });
        await page.evaluate(() => scrollTo(0, 0));
        await page.getByRole('link', { name: 'Connect your agent', exact: true }).click();
        await page.getByRole('heading', { name: 'Make videos with your AI agent', exact: true }).waitFor();
        await page.screenshot({ path: `${out}/guide-${width}-${theme}.png` });
        report.push({
          guide: page.url(),
          width,
          overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        });
      }
      await context.close();
    }
  }
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    reducedMotion: 'reduce',
    recordVideo: { dir: out, size: { width: 1024, height: 768 } },
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('h1').waitFor({ timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.waitForTimeout(1500);
  await page.waitForTimeout(6000);
  if (version === 'after') {
    await page.getByRole('link', { name: 'Connect your agent', exact: true }).click();
    await page.getByRole('heading', { name: 'Make videos with your AI agent', exact: true }).waitFor();
    await page.waitForTimeout(4000);
  }
  await context.close();
  await page.video().saveAs(`${out}/${version}.webm`);
}
for (const lang of ['fr', 'de', 'es', 'it']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:5412/${lang}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('h1').waitFor({ timeout: 90000 });
  await page.waitForTimeout(2000);
  report.push({
    lang,
    headline: await page.locator('h1').innerText(),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  });
  await page.screenshot({ path: `${out}/after-${lang}.png` });
  await page.close();
}
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
