// Record real screen-capture VIDEO clips of the web app's video-creation flow (/studio → editor →
// render) for the Remotion "create a video in your browser" promo. Each clip is recorded in its own
// Playwright context (one webm per beat), then transcoded to mp4 into the brand-motion public/captures
// dir, where the WebCreate composition embeds them via <OffthreadVideo>/staticFile().
//
// Needs the dev server up:  pnpm --filter @leclap/web dev   (default :5174; override with E2E_BASE_URL)
// Needs ffmpeg on PATH. Run:  node apps/leclap-web/scripts/capture-studio.ts  [--only gallery,compose,result]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5174';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../../packages/leclap-brand-motion/public/captures');
const recDir = '/tmp/leclap-studio-rec';
const SIZE = { width: 1600, height: 900 };
const TEMPLATE = 'spotlight';
const SAMPLE = path.resolve(here, '../../../packages/leclap-creative-kit/src/library/videos/earth.mp4');

// Run an async step for each item in order (a lint-clean alternative to `await` inside a for-loop).
const forEachSeq = async <T>(items: readonly T[], fn: (item: T) => Promise<void>): Promise<void> => {
  await items.reduce<Promise<void>>((prev, item) => prev.then(() => fn(item)), Promise.resolve());
};

const editor = async (page: Page): Promise<void> => {
  await page.goto(`${BASE}/studio/new?template=${TEMPLATE}`);
  await page.getByPlaceholder(/enter your name/i).waitFor({ state: 'visible' });
  await page.waitForTimeout(600);
};

// Fill the form + upload a clip; the preview fills with the footage.
const compose = async (page: Page): Promise<void> => {
  await editor(page);
  await page.getByPlaceholder(/enter your name/i).fill('Alex');
  await page.waitForTimeout(700);
  await page.getByText('Record your clip', { exact: false }).first().click();
  await page.waitForTimeout(900);
  await page.locator('input[type=file]').first().setInputFiles(SAMPLE);
  await page.waitForTimeout(3200);
};

// The studio gallery — slow scroll through the template cards.
const gallery = async (page: Page): Promise<void> => {
  await page.goto(`${BASE}/studio`);
  await page.getByText('Spotlight', { exact: false }).first().waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  await forEachSeq([320, 320, -640] as const, async (dy) => {
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(900);
  });
};

// The full create: compose, then "Create my video" → render → the finished clip plays.
const createFlow = async (page: Page): Promise<void> => {
  await compose(page);
  await page.getByRole('button', { name: /create my video/i }).click();
  // The result screen shows the rendered <video>; wait it out, then play a few seconds.
  await page.getByText(/create another video/i).waitFor({ state: 'visible', timeout: 7 * 60 * 1000 });
  await page.waitForTimeout(600);
  await page
    .locator('video')
    .first()
    .evaluate((v: HTMLVideoElement) => v.play())
    .catch(() => {});
  await page.waitForTimeout(4500);
};

interface ClipOpts {
  tailSeconds?: number;
  startSeconds?: number;
}

const seekArgs = (opts: ClipOpts): string[] => {
  if (opts.tailSeconds) return ['-sseof', `-${opts.tailSeconds}`];

  if (opts.startSeconds) return ['-ss', `${opts.startSeconds}`];

  return [];
};

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
  execFileSync(
    'ffmpeg',
    [
      ...seekArgs(opts),
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

const onlyArg = process.argv[process.argv.indexOf('--only') + 1];
const only = process.argv.includes('--only') && onlyArg ? new Set(onlyArg.split(',')) : null;
const wanted = (name: string): boolean => only === null || only.has(name);

const main = async (): Promise<void> => {
  fs.mkdirSync(recDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    args: ['--disk-cache-dir=/tmp/leclap-pw-cache', '--disk-cache-size=104857600'],
  });

  if (wanted('gallery')) await clip(browser, 'studio-gallery', gallery);

  if (wanted('compose')) await clip(browser, 'studio-compose', compose, { startSeconds: 1.5 });

  if (wanted('result')) await clip(browser, 'studio-result', createFlow, { tailSeconds: 5.5 });

  await browser.close();
  process.stdout.write('done\n');
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
