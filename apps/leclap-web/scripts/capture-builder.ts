// Record real screen-capture VIDEO clips of the web template builder (/templates/new) for the Remotion
// promos (Marketing, the showcase's desktop beat). Each beat is screencast in its own 2x context
// (scripts/screencast.ts — crisp, high-bitrate) into the brand-motion repo's public/captures dir, where
// the compositions embed them via <OffthreadVideo>/staticFile().
// They land in the private leclap-brand-motion repo (github.com/heristop/leclap-brand-motion):
// LECLAP_BRAND_MOTION points at its checkout, a sibling of this monorepo by default.
//
// Needs the dev server up:  pnpm --filter @leclap/web dev   (default :5174; override with E2E_BASE_URL)
// Needs ffmpeg on PATH. Run:  node apps/leclap-web/scripts/capture-builder.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { recordScreencast } from './screencast.ts';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5174';
const here = path.dirname(fileURLToPath(import.meta.url));
const brandMotion = process.env.LECLAP_BRAND_MOTION ?? path.resolve(here, '../../../../leclap-brand-motion');
const outDir = path.join(brandMotion, 'public/captures');
const SIZE = { width: 1440, height: 900 };

// Run an async step for each item in order (a lint-clean alternative to `await` inside a for-loop).
const forEachSeq = async <T>(items: readonly T[], fn: (item: T) => Promise<void>): Promise<void> => {
  await items.reduce<Promise<void>>((prev, item) => prev.then(() => fn(item)), Promise.resolve());
};

// /templates/new opens a "Start your template" dialog: answer it (`start` names a ready-made structure,
// default a blank canvas), then wait for the builder itself.
const ready = async (page: Page, start: RegExp = /Start blank/): Promise<void> => {
  await page.goto(`${BASE}/templates/new`);
  const choice = page.getByRole('button', { name: start });
  await choice.waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  await choice.click();
  await page.getByRole('button', { name: /Render a preview|Preview render/i }).waitFor({ state: 'visible' });
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

// Build scenes the way a person would: start from the Product showcase structure (photo, clip and music
// land in the timeline), swap the photo, then retype the caption on the canvas. The canvas shows real
// content at every step — a colour scene reads as a flat box once the builder is shrunk into a film frame.
const buildScenes = async (page: Page): Promise<void> => {
  await ready(page, /Product showcase/);
  await page
    .getByText('Golden Hour', { exact: true })
    .click()
    .catch(() => {});
  await page.waitForTimeout(1000);

  // The caption is the canvas's draggable text box: double-click to edit, replace its text, commit.
  const caption = page.locator('.cursor-move').first();
  await caption.waitFor({ state: 'visible', timeout: 8000 });
  const rect = await caption.boundingBox();

  if (!rect) return;
  await page.mouse.dblclick(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.waitForTimeout(250);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Summer collection', { delay: 70 });
  await page.keyboard.press('Enter');
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
  await page.getByRole('button', { name: /Render a preview|Preview render/i }).click();
  const video = page.getByRole('dialog').locator('video');
  await video.waitFor({ state: 'visible', timeout: 7 * 60 * 1000 });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /play/i })
    .click()
    .catch(() => {});
  await page.waitForTimeout(4500);
};

// Optional `--only a,b` filter so a single flaky clip can be re-recorded without redoing the rest.
const onlyArg = process.argv[process.argv.indexOf('--only') + 1];
const only = process.argv.includes('--only') && onlyArg ? new Set(onlyArg.split(',')) : null;
const wanted = (name: string): boolean => only === null || only.has(name);

const main = async (): Promise<void> => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    args: ['--disk-cache-dir=/tmp/leclap-pw-cache', '--disk-cache-size=104857600'],
  });

  const out = (name: string): string => path.join(outDir, `${name}.mp4`);

  if (wanted('build-scenes')) {
    await recordScreencast(browser, SIZE, buildScenes, out('build-scenes'), { startSeconds: 9 });
  }

  if (wanted('pick-background')) {
    await recordScreencast(browser, SIZE, pickBackground, out('pick-background'), { startSeconds: 2.7 });
  }

  if (wanted('canvas-drag')) {
    await recordScreencast(browser, SIZE, canvasDrag, out('canvas-drag'), { startSeconds: 2.4 });
  }

  if (wanted('preview-render')) {
    await recordScreencast(browser, SIZE, previewRender, out('preview-render'), { tailSeconds: 8 });
  }

  await browser.close();
  process.stdout.write('done\n');
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
