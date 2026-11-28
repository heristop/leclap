// Evidence for the chromatic fx pull request: the same template (template.json) opened in the web builder
// on the merge base ("before") and on the branch ("after"), with Playwright. Writes the WebP stills next to
// this file; the raw WebM captures and PNG frames go to build/pr/fx-chromatic.
//
//   BEFORE=http://127.0.0.1:5872 AFTER=http://127.0.0.1:5871 node .github/pr-media/fx-chromatic/record.mjs [stills|video]
//
// BEFORE runs a dev server on the merge-base worktree, AFTER on the branch. Both need the CLI built on the
// branch (`packages/leclap-cli/dist`, it makes the builder link) and ffmpeg (libwebp) on PATH.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const require = createRequire(path.join(ROOT, 'apps/leclap-web/package.json'));
const { chromium } = require('@playwright/test');

const SIDES = { before: process.env.BEFORE, after: process.env.AFTER };
const OUT = import.meta.dirname;
const SCRATCH = path.join(ROOT, 'build/pr/fx-chromatic');
const TEMPLATE = path.join(OUT, 'template.json');
const CLI = path.join(ROOT, 'packages/leclap-cli/dist/index.js');
const VIEWPORTS = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };
fs.mkdirSync(SCRATCH, { recursive: true });

const link = (base) =>
  execFileSync('node', [CLI, 'studio', TEMPLATE, '--base', base], { encoding: 'utf8' })
    .split('\n')
    .find((l) => l.startsWith('http'));

// A fringe pixel is strongly red or strongly blue over the navy plate: only a hit paints those.
const hasFringe = () =>
  [...document.querySelectorAll('canvas')].reduce((count, c) => {
    const ctx = c.getContext('2d');
    if (!ctx || !c.width) return count;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let red = 0;
    let blue = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 128 && d[i] > 200 && d[i + 2] < 120) red++;
      if (d[i + 3] > 128 && d[i + 2] > 200 && d[i] < 120) blue++;
    }
    return Math.max(count, Math.min(red, blue) > 5 ? red + blue : 0);
  }, 0);

function toWebp(png, name) {
  const dest = path.join(OUT, `${name}.webp`);
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    png,
    '-c:v',
    'libwebp',
    '-quality',
    '82',
    dest,
  ]);
  console.log(`${name}.webp  ${(fs.statSync(dest).size / 1024).toFixed(1)} KB`);
}

async function open(browser, side, viewport, options = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: 'dark', ...options });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.warn('pageerror:', e.message));
  await page.goto(link(SIDES[side]));
  await page.waitForTimeout(5000);
  return { context, page };
}

async function selectEffect(page) {
  await page.getByText('Effect', { exact: true }).first().click();
  await page.waitForTimeout(600);
}

async function stills(browser) {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    // before: the link is refused, the builder says why.
    {
      const { context, page } = await open(browser, 'before', viewport);
      await page.screenshot({ path: path.join(SCRATCH, `before-${name}.png`) });
      toWebp(path.join(SCRATCH, `before-${name}.png`), `before-${name}`);
      await context.close();
    }
    // after: the effect selected, caught on a hit.
    {
      const { context, page } = await open(browser, 'after', viewport);
      await selectEffect(page);
      // On a phone the canvas sits behind the Preview tab.
      if (viewport.width < 600) await page.getByRole('tab', { name: 'Preview' }).click();
      // The fringe count peaks at the start of a hit, then settles to 0: measure the peak over a few hits...
      let peak = 0;
      for (let i = 0; i < 200; i++) {
        peak = Math.max(peak, await page.evaluate(hasFringe));
        await page.waitForTimeout(15);
      }
      // ...then freeze the painter's clock the moment a hit is back near it, so the screenshot shows the hit.
      let caught = false;
      for (let i = 0; i < 600 && !caught; i++) {
        caught = await page.evaluate(
          ([src, min]) => {
            if (new Function(`return (${src})()`)() < min) return false;
            window.requestAnimationFrame = () => 0;
            return true;
          },
          [hasFringe.toString(), peak * 0.8]
        );
        if (!caught) await page.waitForTimeout(10);
      }
      if (!caught) throw new Error(`no hit caught at ${name}`);
      await page.screenshot({ path: path.join(SCRATCH, `after-${name}.png`) });
      toWebp(path.join(SCRATCH, `after-${name}.png`), `after-${name}`);
      await context.close();
    }
  }
}

async function videos(browser) {
  for (const side of ['before', 'after']) {
    const dir = path.join(SCRATCH, `raw-${side}`);
    fs.rmSync(dir, { recursive: true, force: true });
    const { context, page } = await open(
      browser,
      side,
      { width: 1024, height: 768 },
      {
        deviceScaleFactor: 1,
        recordVideo: { dir, size: { width: 1024, height: 768 } },
      }
    );
    if (side === 'after') await selectEffect(page);
    await page.waitForTimeout(9000);
    await context.close();
    const webm = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
    fs.renameSync(path.join(dir, webm), path.join(SCRATCH, `${side}.webm`));
  }
}

const browser = await chromium.launch();
const mode = process.argv[2] ?? 'stills';
if (mode === 'stills') await stills(browser);
if (mode === 'video') await videos(browser);
await browser.close();
