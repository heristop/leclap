// Usage: node capture.mjs <before|after> <base-url> <out-dir>
// Scrolls the landing page's render chapter (03) to 100%; when the slam lands Clappy grins, so the open mouth
// is on screen. Stills the page and a mouth close-up at 1440x900 and 390x844 (DSF 2), light and dark, then
// records the same scroll at 1024x768 for the evidence video.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../../apps/leclap-web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const [label, base, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MOUTH = 'path[d^="M274 440"]';

const scrollTo = async (page, target, step) => {
  const pct = page.locator('[data-scrub="percent"]').first();
  for (let i = 0; i < 400; i++) {
    const value = parseInt((await pct.textContent()) ?? '0', 10);
    if (value >= target) return value;
    await page.mouse.wheel(0, step);
    await sleep(40);
  }
  throw new Error('never reached ' + target);
};

const prime = async (page) => {
  await page.goto(`${base}/`, { waitUntil: 'load', timeout: 120000 });
  await sleep(2500);
  for (let i = 0; i < 40 && !(await page.locator('[data-scrub="percent"]').count()); i++) {
    await page.mouse.wheel(0, 400);
    await sleep(150);
  }
  await sleep(800);
};

const land = async (page, fine = [30, 6]) => {
  await scrollTo(page, 90, fine[0]);
  await scrollTo(page, 99, fine[1]);
  await sleep(300);
  const pct = page.locator('[data-scrub="percent"]').first();
  while (parseInt((await pct.textContent()) ?? '0', 10) < 100) {
    await page.mouse.wheel(0, 2);
    await sleep(20);
  }
};

const grin = async (page) => {
  // wait for the grin: the open mouth only exists in grin / wink / love
  let box = null;
  for (let i = 0; i < 120 && !box; i++) {
    const el = page.locator(MOUTH).first();
    if (await el.count()) box = await el.boundingBox();
    if (!box) await sleep(50);
  }
  if (!box) throw new Error('no grin');
  await sleep(500);
  return page.locator(MOUTH).first().boundingBox();
};

for (const scheme of process.env.VIDEO_ONLY ? [] : ['light', 'dark']) {
  for (const [name, width, height] of [
    ['1440', 1440, 900],
    ['390', 390, 844],
  ]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: scheme });
    const page = await ctx.newPage();
    await prime(page);
    await land(page);
    const box = await grin(page);
    await page.screenshot({ path: `${outDir}/${label}-${scheme}-${name}-page.png` });
    console.log(label, scheme, name, JSON.stringify(box));

    // the close-up: same moment, a fixed window around the mouth, rasterised by CDP at 24x so the vectors stay crisp
    const halfW = width === 1440 ? 34 : 20;
    const halfH = halfW * 0.65;
    const [sx, sy] = await page.evaluate(() => [window.scrollX, window.scrollY]);
    const cx = sx + box.x + box.width / 2;
    const cy = sy + box.y + box.height / 2;
    const cdp = await ctx.newCDPSession(page);
    const scale = 900 / (halfW * 2);
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: cx - halfW, y: cy - halfH, width: halfW * 2, height: halfH * 2, scale },
    });
    fs.writeFileSync(`${outDir}/${label}-${scheme}-${name}-mouth.png`, Buffer.from(data, 'base64'));
    await ctx.close();
  }
}

const vdir = `${outDir}/clip-${label}`;
fs.rmSync(vdir, { recursive: true, force: true });
const ctx = await browser.newContext({
  viewport: { width: 1024, height: 768 },
  recordVideo: { dir: vdir, size: { width: 1024, height: 768 } },
  colorScheme: 'dark',
});
const page = await ctx.newPage();
await prime(page);
// Clappy's mouth is ~7 px at 1024 wide and the grin only lasts about a second after the slam: the moment it
// shows, ease the page itself (vector, so it stays crisp) onto the mouth, so the freeze frame is the open mouth.
await land(page, [20, 4]);
let mouth = null;
while (!mouth) {
  mouth = await page
    .locator(MOUTH)
    .first()
    .boundingBox({ timeout: 50 })
    .catch(() => null);
  if (!mouth) await sleep(10);
}
await page.evaluate(
  ({ mouth, scale }) => {
    const px = window.scrollX + mouth.x + mouth.width / 2;
    const py = window.scrollY + mouth.y + mouth.height / 2;
    const root = document.documentElement;
    root.style.transformOrigin = `${px}px ${py}px`;
    root.style.transition = 'transform 0.5s cubic-bezier(0.65, 0, 0.35, 1)';
    root.style.transform = `translate(${window.scrollX + 512 - px}px, ${window.scrollY + 384 - py}px) scale(${scale})`;
  },
  { mouth, scale: 12 }
);
await sleep(4000);
await ctx.close();
await browser.close();
