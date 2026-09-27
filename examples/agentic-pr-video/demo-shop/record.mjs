// Record before/after walkthroughs of the demo shop — the evidence the before/after template expects.
//
//   node demo-shop/record.mjs                 → ./evidence/before.mp4, ./evidence/after.mp4
//   node demo-shop/record.mjs --out ./clips
//
// Needs Playwright (resolved from the project you run this in: `npm i -D @playwright/test` then
// `npx playwright install chromium`) and ffmpeg on PATH, to trim the page load and write H.264.
//
// Each walkthrough is timed to its section of ../before-after.json (BEFORE 3.8 s, AFTER 4.2 s) and
// recorded at 16:9, so the template's cover-crop keeps the header's cart in frame. In a real change,
// point the same two walkthroughs at your app on the base branch and on your branch.
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shop = pathToFileURL(path.join(here, 'index.html')).href;
const outFlag = process.argv.indexOf('--out');
const outDir = path.resolve(outFlag === -1 ? 'evidence' : process.argv[outFlag + 1]);
const SIZE = { width: 1280, height: 720 };

/** Playwright's chromium, from the current project first, then from next to this script. */
function loadChromium() {
  const requirers = [createRequire(path.join(process.cwd(), 'package.json')), createRequire(import.meta.url)];

  for (const requireFrom of requirers) {
    for (const name of ['@playwright/test', 'playwright']) {
      try {
        return requireFrom(name).chromium;
      } catch {
        // try the next candidate
      }
    }
  }

  throw new Error(
    'Playwright not found. In your project: npm i -D @playwright/test && npx playwright install chromium'
  );
}

let pointer = { x: 380, y: 400 };

/** Glide the pointer to (x, y) over `ms` with an ease-in-out, like a hand would. */
async function glide(page, x, y, ms) {
  const from = pointer;
  const steps = Math.max(1, Math.round(ms / 16));

  await Array.from({ length: steps }, (_, index) => index + 1).reduce(
    (previous, step) =>
      previous.then(async () => {
        const t = step / steps;
        const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
        await page.mouse.move(from.x + (x - from.x) * eased, from.y + (y - from.y) * eased);
        await page.waitForTimeout(16);
      }),
    Promise.resolve()
  );
  pointer = { x, y };
}

async function centerOf(page, selector) {
  const box = await page.locator(selector).boundingBox();

  if (!box) throw new Error(`${selector} not on screen`);

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function click(page) {
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
}

// Before: the eye goes to the price, the swatches… the add-to-cart is a faint link under the copy.
// Clicking it changes nothing but a small grey "Cart (1)" in the header.
async function before(page) {
  const swatches = await centerOf(page, '.swatches');
  const link = await centerOf(page, '#tinyAdd');
  const cart = await centerOf(page, '#countPlain');

  await glide(page, 830, 300, 500);
  await page.waitForTimeout(200);
  await glide(page, swatches.x + 40, swatches.y, 450);
  await glide(page, link.x - 8, link.y + 2, 500);
  await page.waitForTimeout(150);
  await click(page);
  await page.waitForTimeout(350);
  await glide(page, cart.x, cart.y + 4, 550);
  await page.waitForTimeout(700);
}

// After: one obvious button where the eye already is; it confirms, the badge pops, the drawer opens.
async function after(page) {
  const add = await centerOf(page, '#add');

  await glide(page, add.x - 30, add.y + 4, 600);
  await page.waitForTimeout(150);
  await click(page);
  await page.waitForTimeout(750);
  const checkout = await centerOf(page, '#checkout');
  await glide(page, checkout.x - 40, checkout.y + 4, 600);
  await page.waitForTimeout(1700);
}

/** Trim the page load off Playwright's webm and write the H.264 clip the template takes. */
function transcode(webm, head, out) {
  const args = ['-v', 'error', '-y', '-ss', head.toFixed(2), '-i', webm, '-r', '30'];
  execFileSync('ffmpeg', [...args, '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-an', out]);
  console.log(`Recorded ${path.relative(process.cwd(), out)}`);
}

/** Record one walkthrough of the shop in the given variant. */
async function record(chromium, variant, walk) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'leclap-demo-shop-'));
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE } });
    const started = Date.now();
    const page = await context.newPage();
    await page.goto(`${shop}?v=${variant}`);
    await page.waitForLoadState('load');
    pointer = { x: 380, y: 400 };
    await page.mouse.move(pointer.x, pointer.y);
    await page.waitForTimeout(250);
    const head = (Date.now() - started) / 1000;
    await walk(page);
    const video = page.video();
    await context.close();
    transcode(await video.path(), head, path.join(outDir, `${variant}.mp4`));
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

try {
  const chromium = loadChromium();
  mkdirSync(outDir, { recursive: true });
  await record(chromium, 'before', before);
  await record(chromium, 'after', after);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
