// Render the LinkedIn launch cut (4:5) to mp4 in ./out. Build-time only, and NOT a site asset — this
// one gets uploaded to LinkedIn by hand, so it stays out of apps/leclap-web/public/videos.
//   pnpm --filter @leclap/brand-motion render:linkedin
// Pass --still to get a single PNG per beat instead, for checking layout without a full render.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, selectComposition, renderMedia, renderStill } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, 'out');

// Same normalization the other promos need: Remotion's H.264 is tagged bt470bg with full-range
// (yuvj420p) pixels, which real hardware decoders render as a frozen first frame. Re-encode to
// limited-range bt709 / yuv420p so the clip plays everywhere, including LinkedIn's own transcode.
const COLOR_FILTER =
  'scale=in_range=full:out_range=tv,format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709';
const COLOR_FLAGS = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'];

const COMPOSITION = 'LeClapLinkedin';
const OUTPUT = 'leclap-linkedin-4x5.mp4';

// Soundtrack, taken from the creative-kit catalogue rather than sourced separately: those tracks are
// already curated and their licences recorded in packages/leclap-creative-kit/src/media.ts. This one is
// Pixabay License (leberch) — free for commercial use with NO attribution required, unlike the Kevin
// MacLeod entries in the same catalogue, which are CC BY 3.0 and would oblige a credit in the post.
const MUSIC = path.resolve(here, '../leclap-creative-kit/src/library/musics/lofi-hip-hop.mp3');
// Trimmed to the video, eased in, and faded out over the CTA so it never gets cut off mid-bar.
const MUSIC_FILTER = '[1:a]atrim=0:23,asetpts=N/SR/TB,afade=t=in:st=0:d=0.8,afade=t=out:st=21.5:d=1.5,volume=0.55[a]';

// One frame in the middle of each beat plus the CTA, for a cheap layout check.
const STILL_FRAMES = [140, 300, 460, 640];

mkdirSync(outDir, { recursive: true });
await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, 'src/index.ts') });
const composition = await selectComposition({ serveUrl, id: COMPOSITION });

// Sequential: each still spins up a page, and the brand font load is delayRender-gated.
const renderLayoutStills = async (): Promise<void> => {
  await STILL_FRAMES.reduce<Promise<void>>(
    (prev, frame) =>
      prev.then(async () => {
        const out = path.resolve(outDir, `linkedin-frame-${frame}.png`);
        await renderStill({ composition, serveUrl, frame, output: out, timeoutInMilliseconds: 120_000 });
        console.log(`Still  ${out}`);
      }),
    Promise.resolve()
  );
};

const renderCut = async (): Promise<void> => {
  const out = path.resolve(outDir, OUTPUT);
  const rawMp4 = out.replace(/\.mp4$/, '.raw.mp4');

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: rawMp4,
    concurrency: 4,
    timeoutInMilliseconds: 120_000,
  });

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      rawMp4,
      '-i',
      MUSIC,
      '-filter_complex',
      `[0:v]${COLOR_FILTER}[v];${MUSIC_FILTER}`,
      '-map',
      '[v]',
      '-map',
      '[a]',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      ...COLOR_FLAGS,
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-shortest',
      '-movflags',
      '+faststart',
      out,
    ],
    { stdio: 'inherit' }
  );
  rmSync(rawMp4, { force: true });
  console.log(`Rendered ${out} (${composition.width}x${composition.height}, ${composition.durationInFrames} frames)`);
};

await (process.argv.includes('--still') ? renderLayoutStills() : renderCut());
