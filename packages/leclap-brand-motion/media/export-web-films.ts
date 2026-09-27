// Export the films for the website (apps/leclap-web/public/videos/films, read by the home page's film
// players): per film and language, a web MP4 (H.264 CRF 24 + AAC, faststart), a poster (WebP) and WebVTT
// captions built from the narration — each line's display text, timed by the voice manifest the render used.
//   node media/export-web-films.ts [--film showcase|agentic] [--lang en|fr]
// Without flags it exports every film × language that has a render in out/ (render-film.ts writes them).
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FILMS, type FilmId } from '../audio/films.ts';
import type { Lang } from '../src/film/lang.tsx';
import { NARRATION } from '../src/film/narration.ts';
import type { VoiceLine } from '../src/showcase/voice-lines.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, '..');
const webDir = path.resolve(pkg, '../../apps/leclap-web/public/videos/films');

// Poster frames that carry each film without text clashing with the player's play pill.
const POSTER_AT: Record<FilmId, number> = { showcase: 5.6, agentic: 9.2 };
const LANGS: readonly Lang[] = ['en', 'fr'];

/** A line's on-screen text: its caption when the spoken text is spelled for the voice, else the text. */
type CaptionedLine = VoiceLine & { caption?: Partial<Record<Lang, string>> };

const renderPath = (film: FilmId, lang: Lang): string =>
  path.join(pkg, 'out', lang === 'en' ? `leclap-${film}.mp4` : `leclap-${film}.${lang}.mp4`);

const vttTime = (seconds: number): string => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23);

const display = (line: CaptionedLine | undefined, lang: Lang): string =>
  (line?.caption?.[lang] ?? line?.text[lang] ?? '')
    .replace(/\[\[slnc \d+\]\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const captions = (film: FilmId, lang: Lang): string => {
  // Timed by the narration the cut plays (English for the French cut too), worded in the cut's language.
  const manifest = JSON.parse(readFileSync(FILMS[film].voice[NARRATION[lang]].manifestPath, 'utf8')) as {
    lines: { id: string; start: number; duration: number }[];
  };
  const byId = new Map<string, CaptionedLine>(FILMS[film].lines.map((line) => [line.id, line]));
  const cues = manifest.lines.map(
    ({ id, start, duration }) => `${vttTime(start)} --> ${vttTime(start + duration)}\n${display(byId.get(id), lang)}`
  );

  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
};

const exportFilm = (film: FilmId, lang: Lang): void => {
  const input = renderPath(film, lang);

  if (!existsSync(input)) {
    console.log(`skip ${film} (${lang}): no render at ${path.relative(pkg, input)}`);

    return;
  }

  const base = path.join(webDir, `leclap-${film}.${lang}`);
  const encode = ['-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-tune', 'animation', '-pix_fmt', 'yuv420p'];
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    ...encode,
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    `${base}.mp4`,
  ]);
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-ss',
    String(POSTER_AT[film]),
    '-i',
    input,
    '-frames:v',
    '1',
    '-vf',
    'scale=1600:-2',
    '-c:v',
    'libwebp',
    '-quality',
    '82',
    `${base}.webp`,
  ]);
  writeFileSync(`${base}.vtt`, captions(film, lang));
  console.log(`exported ${path.relative(process.cwd(), base)}.{mp4,webp,vtt}`);
};

const flag = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);

  return index === -1 ? undefined : process.argv[index + 1];
};

mkdirSync(webDir, { recursive: true });
const films = (flag('film') ? [flag('film')] : Object.keys(FILMS)) as FilmId[];
const langs = (flag('lang') ? [flag('lang')] : LANGS) as Lang[];

for (const film of films) {
  for (const lang of langs) exportFilm(film, lang);
}
