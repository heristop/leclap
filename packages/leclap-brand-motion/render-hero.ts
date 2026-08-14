// Render the README/npm hero — a phone rendering a LeClap template on-device — as an animated GIF.
//   pnpm --filter @leclap/brand-motion render:hero
// Output: .github/media/readme-hero.gif, which README.md links via raw.githubusercontent.com.
//
// Why a GIF and not the mp4 everything else here produces: npm strips GitHub's <video> attachments
// from the README it renders, so the package page — where most people land after a search — shows no
// motion at all. It does render images. A GIF is the only format both surfaces animate.
//
// The budget is the whole design constraint. A README hero that has not finished loading before the
// visitor scrolls past has failed, so this targets <= 5 MB. Three levers get it there:
//   • 15 fps, half the composition's 30 — screen-recording UI reads fine at 15.
//   • a 128-colour palette built with stats_mode=diff, which weights the palette towards the pixels
//     that actually change (the phone screen) instead of the static brand chrome around it.
//   • paletteuse diff_mode=rectangle, so each frame only redraws its changed rectangle.
// The composition itself is built to suit this — see on-device-hero.tsx.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, selectComposition, renderMedia } from '@remotion/renderer';
import { webpackOverride } from './webpack-override.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../.github/media/readme-hero.gif');
const raw = path.resolve(here, 'out/hero-raw.mp4');
const palette = path.resolve(here, 'out/hero-palette.png');

/** Display width in the README column. GitHub and npm both render well under 800px of content. */
const GIF_WIDTH = 720;
const GIF_FPS = 15;
const MAX_BYTES = 5 * 1024 * 1024;

mkdirSync(path.dirname(out), { recursive: true });
mkdirSync(path.resolve(here, 'out'), { recursive: true });

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, 'src/index.ts'), webpackOverride });
const composition = await selectComposition({ serveUrl, id: 'LeClapHero' });

// Lossless-ish intermediate: the GIF quantiser should see the render, not h264 ringing around the
// phone's UI text. Capped concurrency + a generous timeout because OffthreadVideo runs one ffmpeg
// frame-extract per frame and would otherwise starve the brand-font delayRender.
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  crf: 14,
  outputLocation: raw,
  concurrency: 4,
  timeoutInMilliseconds: 120_000,
});

const ffmpeg = (args: readonly string[]): void => {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
};

const scale = `fps=${GIF_FPS},scale=${GIF_WIDTH}:-2:flags=lanczos`;

ffmpeg(['-i', raw, '-vf', `${scale},palettegen=max_colors=128:stats_mode=diff`, '-frames:v', '1', palette]);
ffmpeg([
  '-i',
  raw,
  '-i',
  palette,
  '-lavfi',
  `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
  '-loop',
  '0',
  out,
]);

rmSync(raw, { force: true });
rmSync(palette, { force: true });

const bytes = statSync(out).size;
const seconds = composition.durationInFrames / composition.fps;
console.log(`Rendered ${out} (${GIF_WIDTH}px, ${GIF_FPS}fps, ${seconds}s, ${(bytes / 1024 / 1024).toFixed(2)} MB)`);

// Fail loudly rather than committing a hero nobody will wait for. If this trips, drop GIF_WIDTH to
// 640 or GIF_FPS to 12 — do not just raise the ceiling.
if (bytes > MAX_BYTES) {
  throw new Error(`hero GIF is ${(bytes / 1024 / 1024).toFixed(2)} MB, over the ${MAX_BYTES / 1024 / 1024} MB budget`);
}
