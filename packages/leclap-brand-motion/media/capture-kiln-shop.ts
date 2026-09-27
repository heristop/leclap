// Capture the Kiln & Co. demo shop (examples/agentic-pr-video/demo-shop) for the showcase's use-case
// renders (media/render-use-cases.ts): a product walkthrough recording plus the brand stills.
//
//   public/captures/kiln-shop/tour.mp4       pick the sage glaze → Add to cart → cart drawer → Checkout
//   media/templates/stills/kiln-mug-oat.png  the mug from the shop's own inline SVG, oat glaze
//   media/templates/stills/kiln-mug-sage.png the same mug in the sage glaze
//   media/templates/stills/kiln-glow.jpg     the warm radial glow behind the brand intro's first beat
//
// Playwright is resolved from the directory you run it in, so run it from the web app:
//   cd apps/leclap-web && node ../../packages/leclap-brand-motion/media/capture-kiln-shop.ts [--stills]
// --stills re-exports the stills only: kiln-product-demo.json's captions and camera moves are timed to the
// committed tour.mp4, so a new recording means re-checking those timings. Needs ffmpeg on PATH (trims
// the page load and writes H.264 tagged Rec.709).
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Page {
  goto: (url: string) => Promise<unknown>;
  setContent: (html: string) => Promise<void>;
  screenshot: (options: { path: string; type?: 'jpeg'; quality?: number }) => Promise<unknown>;
  waitForLoadState: (state: 'load') => Promise<void>;
  waitForTimeout: (ms: number) => Promise<void>;
  addStyleTag: (options: { content: string }) => Promise<unknown>;
  click: (selector: string) => Promise<void>;
  mouse: { move: (x: number, y: number) => Promise<void>; down: () => Promise<void>; up: () => Promise<void> };
  locator: (selector: string) => {
    boundingBox: () => Promise<Box | null>;
    screenshot: (options: { path: string; omitBackground: boolean }) => Promise<unknown>;
  };
  video: () => { path: () => Promise<string> } | null;
}

interface Context {
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
}

interface Browser {
  newContext: (options: Record<string, unknown>) => Promise<Context>;
  close: () => Promise<void>;
}

interface Chromium {
  launch: () => Promise<Browser>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../../..');
const SHOP = pathToFileURL(path.join(REPO, 'examples/agentic-pr-video/demo-shop/index.html')).href;
const TOUR_OUT = path.resolve(here, '../public/captures/kiln-shop/tour.mp4');
const STILLS = path.resolve(here, 'templates/stills');
const SIZE = { width: 1280, height: 720 };

/** Playwright's chromium, resolved from the current project (the web app has @playwright/test). */
const loadChromium = (): Chromium => {
  const requireFrom = createRequire(path.join(process.cwd(), 'package.json'));

  for (const name of ['@playwright/test', 'playwright']) {
    try {
      return (requireFrom(name) as { chromium: Chromium }).chromium;
    } catch {
      // try the next candidate
    }
  }

  throw new Error('Playwright not found — run this from apps/leclap-web (it has @playwright/test).');
};

let pointer = { x: 380, y: 400 };

/** Glide the pointer to (x, y) over `ms` with an ease-in-out, like a hand would. */
const glide = async (page: Page, to: { x: number; y: number }, ms: number): Promise<void> => {
  const from = pointer;
  const steps = Math.max(1, Math.round(ms / 16));

  await Array.from({ length: steps }, (_, index) => index + 1).reduce(
    (previous, step) =>
      previous.then(async () => {
        const t = step / steps;
        const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
        await page.mouse.move(from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased);
        await page.waitForTimeout(16);
      }),
    Promise.resolve()
  );
  pointer = to;
};

const centerOf = async (page: Page, selector: string, nudge = { x: 0, y: 0 }): Promise<{ x: number; y: number }> => {
  const box = await page.locator(selector).boundingBox();

  if (!box) throw new Error(`${selector} not on screen`);

  return { x: box.x + box.width / 2 + nudge.x, y: box.y + box.height / 2 + nudge.y };
};

const click = async (page: Page): Promise<void> => {
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
};

// The walkthrough: the sage swatch (the hero mug re-glazes), the primary button (it confirms, the
// badge pops, the drawer slides in), then onto Checkout. Paced for a ~5s walkthrough section.
const tour = async (page: Page): Promise<void> => {
  await page.waitForTimeout(250);
  await glide(page, await centerOf(page, '#sage', { x: -2, y: 2 }), 650);
  await page.waitForTimeout(120);
  await click(page);
  await page.waitForTimeout(600);
  await glide(page, await centerOf(page, '#add', { x: -40, y: 4 }), 650);
  await page.waitForTimeout(140);
  await click(page);
  await page.waitForTimeout(700);
  await glide(page, await centerOf(page, '#checkout', { x: -36, y: 4 }), 600);
  await page.waitForTimeout(1300);
};

/** Trim the page load off Playwright's webm and write the H.264 clip, converted and tagged Rec.709. */
const transcode = (webm: string, head: number, out: string): void => {
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-ss',
    head.toFixed(2),
    '-i',
    webm,
    '-r',
    '30',
    '-vf',
    'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v',
    'libx264',
    '-crf',
    '16',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-color_range',
    'tv',
    '-an',
    out,
  ]);
};

const recordTour = async (browser: Browser): Promise<void> => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'leclap-kiln-tour-'));

  try {
    const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE } });
    const started = Date.now();
    const page = await context.newPage();
    await page.goto(`${SHOP}?v=after`);
    await page.waitForLoadState('load');
    pointer = { x: 380, y: 400 };
    await page.mouse.move(pointer.x, pointer.y);
    await page.waitForTimeout(250);
    const head = (Date.now() - started) / 1000;
    await tour(page);
    const video = page.video();
    await context.close();

    if (!video) throw new Error('Playwright recorded no video');

    mkdirSync(path.dirname(TOUR_OUT), { recursive: true });
    transcode(await video.path(), head, TOUR_OUT);
    console.log(`Recorded ${path.relative(process.cwd(), TOUR_OUT)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// The hero mug, straight from the shop's inline SVG: backgrounds cleared so the PNG keeps its alpha,
// rendered at 3x (1140px square) so the templates can scale it down crisply.
const exportMugs = async (browser: Browser): Promise<void> => {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 3 });

  try {
    const page = await context.newPage();
    await page.goto(`${SHOP}?v=after`);
    await page.waitForLoadState('load');
    await page.addStyleTag({ content: 'html, body, .hero { background: transparent !important; }' });
    mkdirSync(STILLS, { recursive: true });
    await page.locator('#hero svg').screenshot({ path: path.join(STILLS, 'kiln-mug-oat.png'), omitBackground: true });
    await page.click('#sage');
    await page.locator('#hero svg').screenshot({ path: path.join(STILLS, 'kiln-mug-sage.png'), omitBackground: true });
    console.log(`Exported ${path.relative(process.cwd(), STILLS)}/kiln-mug-{oat,sage}.png`);
  } finally {
    await context.close();
  }
};

// The kiln glow, a still rather than a gradient layer: the engine hands ffmpeg's `gradients` source an
// end point on the frame edge (x1=w, y1=h), which it treats as out of range and re-randomises on every
// render — so a radial layer comes out with a different radius each time. Chromium draws it dithered.
const exportGlow = async (browser: Browser): Promise<void> => {
  const context = await browser.newContext({ viewport: SIZE });

  try {
    const page = await context.newPage();
    await page.setContent(
      '<body style="margin:0;height:100vh;background:radial-gradient(ellipse farthest-corner at 50% 50%,' +
        ' #e59259 0%, #c4642f 30%, #9d4220 62%, #6b2810 100%)"></body>'
    );
    await page.screenshot({ path: path.join(STILLS, 'kiln-glow.jpg'), type: 'jpeg', quality: 92 });
    console.log(`Exported ${path.relative(process.cwd(), STILLS)}/kiln-glow.jpg`);
  } finally {
    await context.close();
  }
};

const browser = await loadChromium().launch();

try {
  if (!process.argv.includes('--stills')) await recordTour(browser);

  await exportMugs(browser);
  await exportGlow(browser);
} finally {
  await browser.close();
}
