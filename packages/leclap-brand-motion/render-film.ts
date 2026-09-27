// Render one of the package's films (narrated and scored, 1920x1080) to mp4.
//   pnpm --filter @leclap/brand-motion render:showcase   → out/leclap-showcase.mp4 (78 s)
//   pnpm --filter @leclap/brand-motion render:agentic    → out/leclap-agentic.mp4 (50 s)
//   … --lang fr            the French cut (LeClapShowcaseFr / LeClapAgenticFr: French text, English narration)
//                          → out/leclap-<film>.fr.mp4, rendered in its own out/<film>-fr-chunks
//   … --no-audio-gen       reuse the existing voice + score instead of regenerating them
//   … --frames 1200-1260   render a slice for a quick look
//   … --concurrency 2      fewer parallel tabs when the machine is short on memory (default 3)
//
// The picture renders in 10-second chunks, each in a fresh browser, each retried on failure and kept
// on disk until the film is assembled — so a crashed tab (the showcase is heavy: video decodes, SVG
// filters, big blurs) costs one chunk, and a re-run resumes where it stopped. The soundtrack renders
// separately — mixed offline from the score and the voice lines with the composition's ducking curve
// (audio/mix-soundtrack.ts) — then everything is muxed. Like render-marketing.ts, the raw Remotion H.264 (bt470bg, full range) is
// re-encoded to limited-range bt709/yuv420p so it decodes and autoplays everywhere.
//
// The voice needs macOS (`say`) and sox; the score is pure Node. See audio/.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import { langFromArgv, langSuffix } from './audio/films.ts';
import { mixSoundtrack } from './audio/mix-soundtrack.ts';
import type { Lang } from './src/film/lang.tsx';
import { NARRATION } from './src/film/narration.ts';
import { webpackOverride } from './webpack-override.ts';

/** Each film's composition per language (Root.tsx). */
const FILMS = {
  showcase: { en: 'LeClapShowcase', fr: 'LeClapShowcaseFr' },
  agentic: { en: 'LeClapAgentic', fr: 'LeClapAgenticFr' },
} satisfies Record<string, Record<Lang, string>>;

const here = path.dirname(fileURLToPath(import.meta.url));
const film = (
  process.argv.includes('--film') ? process.argv[process.argv.indexOf('--film') + 1] : 'showcase'
) as keyof typeof FILMS;

if (!(film in FILMS)) throw new Error(`Unknown film "${film}" — one of: ${Object.keys(FILMS).join(', ')}`);

const lang = langFromArgv();
const outDir = path.resolve(here, 'out');
// Chunks are resumable, so each language keeps its own — a French run never picks up English frames.
const chunkDir = path.resolve(outDir, `${film}${langSuffix(lang, '-')}-chunks`);
const out = path.resolve(outDir, `leclap-${film}${langSuffix(lang)}.mp4`);

const CHUNK_FRAMES = 300;
const ATTEMPTS = 3;

const COLOR_FILTER =
  'scale=in_range=full:out_range=tv,format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709';
const COLOR_FLAGS = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'];

const argValue = (flag: string): string | undefined =>
  process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;

const framesArg = argValue('--frames');
const concurrency = Number(argValue('--concurrency') ?? 3);

// Run an async step for each item in order (a lint-clean alternative to `await` inside a for-loop).
const forEachSeq = async <T>(items: readonly T[], fn: (item: T) => Promise<void>): Promise<void> => {
  await items.reduce<Promise<void>>((prev, item) => prev.then(() => fn(item)), Promise.resolve());
};

const withRetries = async (label: string, attempt: () => Promise<void>, left = ATTEMPTS): Promise<void> => {
  try {
    await attempt();
  } catch (error) {
    if (left <= 1) throw error;

    console.warn(`${label} failed (${String(error).split('\n')[0]}) — retrying, ${left - 1} left`);
    await withRetries(label, attempt, left - 1);
  }
};

if (!process.argv.includes('--no-audio-gen')) {
  execFileSync('node', [path.resolve(here, 'audio/generate-voice.ts'), '--film', film, '--lang', NARRATION[lang]], {
    stdio: 'inherit',
  });
  execFileSync('node', [path.resolve(here, 'audio/generate-score.ts'), '--film', film], { stdio: 'inherit' });
}

mkdirSync(chunkDir, { recursive: true });
await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.resolve(here, 'src/index.ts'), webpackOverride });
const composition = await selectComposition({ serveUrl, id: FILMS[film][lang] });

const [first, last] = framesArg
  ? (framesArg.split('-').map(Number) as [number, number])
  : [0, composition.durationInFrames - 1];

const ranges: [number, number][] = [];

for (let from = first; from <= last; from += CHUNK_FRAMES) ranges.push([from, Math.min(last, from + CHUNK_FRAMES - 1)]);

const common = {
  composition,
  serveUrl,
  concurrency,
  // Every OffthreadVideo frame is extracted and cached; cap the cache so a long render doesn't push
  // the machine into swap (swap files share the disk with the render's temp frames).
  offthreadVideoCacheSizeInBytes: 512 * 1024 * 1024,
  timeoutInMilliseconds: 180_000,
} as const;

const chunkFile = ([from, to]: [number, number]): string =>
  path.resolve(chunkDir, `${String(from).padStart(5, '0')}-${String(to).padStart(5, '0')}.mp4`);

await forEachSeq(ranges, async (range) => {
  const file = chunkFile(range);

  if (existsSync(file)) {
    console.log(`frames ${range.join('–')}: already rendered`);

    return;
  }

  await withRetries(`frames ${range.join('–')}`, async () => {
    const partial = file.replace(/\.mp4$/, '.part.mp4');
    await renderMedia({ ...common, codec: 'h264', crf: 16, muted: true, frameRange: range, outputLocation: partial });
    renameSync(partial, file);
    console.log(`frames ${range.join('–')}: done`);
  });
});

// The soundtrack is mixed offline with the composition's own ducking curve — rendering it through
// Remotion would re-evaluate every frame of the picture just to collect two audio tracks.
const audio = path.resolve(chunkDir, `audio-${first}-${last}.wav`);
mixSoundtrack(film, lang, audio, first / composition.fps, (last + 1) / composition.fps);

const list = path.resolve(chunkDir, 'chunks.txt');
writeFileSync(list, ranges.map((range) => `file '${chunkFile(range)}'`).join('\n'));

execFileSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-i',
    audio,
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-vf',
    COLOR_FILTER,
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-crf',
    '18',
    '-preset',
    'slow',
    '-pix_fmt',
    'yuv420p',
    ...COLOR_FLAGS,
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-movflags',
    '+faststart',
    out,
  ],
  { stdio: 'inherit' }
);

// Chunks are only thrown away once the film is assembled, so an interrupted run resumes.
rmSync(chunkDir, { recursive: true, force: true });
// bundle() leaves a ~50 MB webpack build in the OS temp dir on every run; don't let them pile up.
rmSync(serveUrl, { recursive: true, force: true });
console.log(
  `Rendered ${path.relative(process.cwd(), out)} (${composition.width}x${composition.height}, frames ${first}–${last})`
);
