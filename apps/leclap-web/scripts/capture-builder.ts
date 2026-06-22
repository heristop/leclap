// Record real screen-capture VIDEO clips of the web template builder (/templates/new) for the Remotion
// marketing promo. Each clip is recorded in its own Playwright context (one webm per beat), then
// transcoded to mp4 (h264/yuv420p) into the brand-motion package's public/captures dir, where the
// Marketing composition embeds them via <OffthreadVideo>/staticFile().
//
// Needs the dev server up:  pnpm --filter @leclap/web dev   (default :5174; override with E2E_BASE_URL)
// Needs ffmpeg on PATH. Run:  node apps/leclap-web/scripts/capture-builder.ts
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5174';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../../packages/leclap-brand-motion/public/captures');
const recDir = '/tmp/leclap-promo-rec';
const SIZE = { width: 1440, height: 900 };

// Run an async step for each item in order (a lint-clean alternative to `await` inside a for-loop).
const forEachSeq = async <T>(items: readonly T[], fn: (item: T) => Promise<void>): Promise<void> => {
  await items.reduce<Promise<void>>((prev, item) => prev.then(() => fn(item)), Promise.resolve());
};

const ready = async (page: Page): Promise<void> => {
  await page.goto(`${BASE}/templates/new`);
  await page.getByRole('button', { name: /Render a preview/i }).waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
};

const addScene = async (page: Page, label: string): Promise<void> => {
  await page.getByRole('button', { name: 'Add scene' }).last().click();
  const menu = page.getByRole('menu', { name: 'Add scene' });
  await menu.waitFor({ state: 'visible' });
  await menu.getByRole('menuitem', { name: label }).click();
  await menu.waitFor({ state: 'hidden' });
  await page.waitForTimeout(900);
};

// Build → add a color scene → add an image scene; the canvas and timeline fill in live.
const buildScenes = async (page: Page): Promise<void> => {
  await ready(page);
  await addScene(page, 'Color background');
  await page.waitForTimeout(900);
  await addScene(page, 'Background image');
  await page.waitForTimeout(1600);
};

// Image scene → click through the background library; the center monitor swaps each photo live.
const pickBackground = async (page: Page): Promise<void> => {
  await ready(page);
  await addScene(page, 'Background image');
  await forEachSeq(['Green Forest', 'Rocky Coast', 'Golden Hour', 'Forest & Sea'], async (name) => {
    await page
      .getByText(name, { exact: true })
      .click()
      .catch(() => {});
    await page.waitForTimeout(1100);
  });
};

// Press the pointer at (cx,cy) and walk it through a series of [dx,dy] offsets, then release.
const dragThrough = async (
  page: Page,
  cx: number,
  cy: number,
  deltas: readonly (readonly [number, number])[]
): Promise<void> => {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await forEachSeq(deltas, async ([dx, dy]) => {
    await page.mouse.move(cx + dx, cy + dy, { steps: 20 });
    await page.waitForTimeout(280);
  });
  await page.mouse.up();
};

// Color scene → add a text element, give it text, then drag it around the canvas (the WYSIWYG editor).
const canvasDrag = async (page: Page): Promise<void> => {
  await ready(page);
  await addScene(page, 'Color background');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'Text' }).click();
  await page.waitForTimeout(700);

  // The new text overlay is the (only) draggable box on the canvas. Double-click to edit, type, commit.
  const boxLoc = page.locator('.cursor-move').first();
  await boxLoc.waitFor({ state: 'visible', timeout: 8000 });
  const rect = await boxLoc.boundingBox();

  if (!rect) return;
  await page.mouse.dblclick(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.waitForTimeout(300);
  await page.keyboard.type('Your story', { delay: 55 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  const moved = await boxLoc.boundingBox();

  if (!moved) return;
  await dragThrough(page, moved.x + moved.width / 2, moved.y + moved.height / 2, [
    [150, -100],
    [-210, 70],
    [80, 130],
    [0, -50],
  ]);
  await page.waitForTimeout(800);
};

// A couple of scenes → Preview render → play the on-device draft. (Trimmed to the tail in transcode.)
const previewRender = async (page: Page): Promise<void> => {
  await ready(page);
  await addScene(page, 'Color background');
  await addScene(page, 'Background image');
  await page.getByRole('button', { name: /Render a preview/i }).click();
  const video = page.getByRole('dialog').locator('video');
  await video.waitFor({ state: 'visible', timeout: 7 * 60 * 1000 });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /play/i })
    .click()
    .catch(() => {});
  await page.waitForTimeout(4500);
};

interface ClipOpts {
  // Keep only the last N seconds (skip the preview compile wait, keep just the playback).
  tailSeconds?: number;
  // Drop the first N seconds (skip setup so the action lands in the promo's beat window).
  startSeconds?: number;
}

// One clip: record the scenario in its own context, then transcode the webm to mp4 (optionally trimming
// the head/tail so the kept window is the part the promo shows).
const clip = async (
  browser: Browser,
  name: string,
  scenario: (page: Page) => Promise<void>,
  opts: ClipOpts = {}
): Promise<void> => {
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: recDir, size: SIZE } });
  const page = await context.newPage();
  await scenario(page).catch((error: unknown) => {
    process.stderr.write(`[${name}] scenario failed: ${error instanceof Error ? error.message : String(error)}\n`);
  });
  const video = page.video();
  await context.close();

  if (!video) return;
  const src = await video.path();
  const dest = path.join(outDir, `${name}.mp4`);
  const trim = seekArgs(opts);
  execFileSync(
    'ffmpeg',
    [
      ...trim,
      '-y',
      '-i',
      src,
      '-an',
      '-vf',
      'format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-movflags',
      '+faststart',
      dest,
    ],
    { stdio: 'ignore' }
  );
  process.stdout.write(`rendered ${name}.mp4\n`);
};

// ffmpeg input-seek args for a clip's trim window (placed before `-i`).
const seekArgs = (opts: ClipOpts): string[] => {
  if (opts.tailSeconds) return ['-sseof', `-${opts.tailSeconds}`];

  if (opts.startSeconds) return ['-ss', `${opts.startSeconds}`];

  return [];
};

// Optional `--only a,b` filter so a single flaky clip can be re-recorded without redoing the rest.
const onlyArg = process.argv[process.argv.indexOf('--only') + 1];
const only = process.argv.includes('--only') && onlyArg ? new Set(onlyArg.split(',')) : null;
const wanted = (name: string): boolean => only === null || only.has(name);

const main = async (): Promise<void> => {
  fs.mkdirSync(recDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    args: ['--disk-cache-dir=/tmp/leclap-pw-cache', '--disk-cache-size=104857600'],
  });

  if (wanted('build-scenes')) await clip(browser, 'build-scenes', buildScenes);

  if (wanted('pick-background')) await clip(browser, 'pick-background', pickBackground, { startSeconds: 2.7 });

  if (wanted('canvas-drag')) await clip(browser, 'canvas-drag', canvasDrag, { startSeconds: 2.4 });

  if (wanted('preview-render')) await clip(browser, 'preview-render', previewRender, { tailSeconds: 8 });

  await browser.close();
  process.stdout.write('done\n');
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
