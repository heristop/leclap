// Render the LeClap template-builder marketing promo (landscape + portrait) to mp4. Build-time only —
// run `pnpm --filter @leclap/brand-motion render:marketing` after refreshing public/captures and the
// Marketing composition. Capture the source frames first with:
//   node apps/leclap-web/scripts/capture-builder.ts   (dev server up)
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, selectComposition, renderMedia } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const videosDir = path.resolve(here, '../../apps/leclap-web/public/videos');

// Remotion's H.264 output is tagged bt470bg with full-range (yuvj420p) pixels. Real Chrome's hardware VP9/
// H.264 decoder renders that as a frozen first frame (headless's software decoder tolerates it), so the
// promos never autoplayed on the home page. Re-encode every output to a limited-range bt709 / yuv420p
// profile — the tagging drink-and-coffee already carries — so the clips decode and autoplay everywhere.
const COLOR_FILTER =
  'scale=in_range=full:out_range=tv,format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709';
const COLOR_FLAGS = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'];

const targets = [
  { id: 'LeClapMarketing', file: 'leclap-builder-promo.mp4' },
  { id: 'LeClapMarketingPortrait', file: 'leclap-builder-promo-portrait.mp4' },
  { id: 'LeClapWebCreate', file: 'leclap-create-promo.mp4' },
  { id: 'LeClapWebCreatePortrait', file: 'leclap-create-promo-portrait.mp4' },
];

// Optional `--only id1,id2` filter to re-render a subset (e.g. just the Android promo).
const onlyArg = process.argv[process.argv.indexOf('--only') + 1];
const only = process.argv.includes('--only') && onlyArg ? new Set(onlyArg.split(',')) : null;

// Run an async step for each item in order (a lint-clean alternative to `await` inside a for-loop).
const forEachSeq = async <T>(items: readonly T[], fn: (item: T) => Promise<void>): Promise<void> => {
  await items.reduce<Promise<void>>((prev, item) => prev.then(() => fn(item)), Promise.resolve());
};

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, 'src/index.ts') });

// Render each target sequentially — they embed OffthreadVideo clips (one ffmpeg frame-extract per frame),
// so capped concurrency + a generous delayRender timeout keep the brand-font load from starving under
// that load (a 28s default times out mid-render otherwise).
await forEachSeq(targets, async (target) => {
  if (only && !only.has(target.id)) return;

  const out = path.resolve(videosDir, target.file);
  const rawMp4 = out.replace(/\.mp4$/, '.raw.mp4');
  const webm = out.replace(/\.mp4$/, '.webm');
  const composition = await selectComposition({ serveUrl, id: target.id });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: rawMp4,
    concurrency: 4,
    timeoutInMilliseconds: 120_000,
  });

  // Normalize the raw render into the H.264/MP4 fallback the page serves...
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      rawMp4,
      '-vf',
      COLOR_FILTER,
      '-c:v',
      'libx264',
      '-profile:v',
      'main',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      ...COLOR_FLAGS,
      '-movflags',
      '+faststart',
      '-an',
      out,
    ],
    { stdio: 'inherit' }
  );
  // ...and a smaller VP9/WebM the home page serves first, from the same raw source.
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      rawMp4,
      '-vf',
      COLOR_FILTER,
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      '33',
      '-row-mt',
      '1',
      '-pix_fmt',
      'yuv420p',
      ...COLOR_FLAGS,
      '-an',
      webm,
    ],
    { stdio: 'inherit' }
  );
  rmSync(rawMp4, { force: true });
  console.log(`Rendered ${out} + ${path.basename(webm)} (${composition.width}x${composition.height})`);
});
