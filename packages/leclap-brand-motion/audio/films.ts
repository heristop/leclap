// The films this package scores and narrates, and where each one's audio lives. The composition side
// reads the same paths (its voice-manifest[.<lang>].json and public/<film>/…). The score is shared by
// every language; the narration is rendered once per language.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Lang } from '../src/film/lang.tsx';
import { DURATION as SHOWCASE_DURATION } from '../src/showcase/timeline.ts';
import { VOICE_LINES as SHOWCASE_LINES, type VoiceLine } from '../src/showcase/voice-lines.ts';
import { DURATION as AGENTIC_DURATION } from '../src/agentic/timeline.ts';
import { VOICE_LINES as AGENTIC_LINES } from '../src/agentic/voice-lines.ts';
import { arrangeAgentic } from './scores/agentic.ts';
import { arrangeShowcase } from './scores/showcase.ts';
import type { Score } from './synth.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, '..');

/** One language's narration files for a film. */
export interface FilmVoice {
  /** public/<film>/voice (English) or public/<film>/voice-<lang>. */
  dir: string;
  /** voice-manifest.json (English) or voice-manifest.<lang>.json, next to the film's composition. */
  manifestPath: string;
  /** How the composition references the voice files (relative to public/). */
  publicPath: string;
}

export interface Film {
  duration: number;
  lines: readonly VoiceLine[];
  arrange: (score: Score) => void;
  scorePath: string;
  voice: Record<Lang, FilmVoice>;
}

/**
 * How a language marks its files: `.fr` / `-fr` for French, nothing for English — which keeps the names
 * it had before the films were bilingual (voice/, voice-manifest.json, out/leclap-showcase.mp4…).
 */
export const langSuffix = (lang: Lang, separator = '.'): string => (lang === 'en' ? '' : `${separator}${lang}`);

const voiceFiles = (film: string, lang: Lang): FilmVoice => {
  const dir = `voice${langSuffix(lang, '-')}`;

  return {
    dir: path.join(pkg, 'public', film, dir),
    manifestPath: path.join(pkg, 'src', film, `voice-manifest${langSuffix(lang)}.json`),
    publicPath: `${film}/${dir}`,
  };
};

export const FILMS = {
  showcase: {
    duration: SHOWCASE_DURATION,
    lines: SHOWCASE_LINES,
    arrange: arrangeShowcase,
    scorePath: path.join(pkg, 'public/showcase/score.wav'),
    voice: { en: voiceFiles('showcase', 'en'), fr: voiceFiles('showcase', 'fr') },
  },
  agentic: {
    duration: AGENTIC_DURATION,
    lines: AGENTIC_LINES,
    arrange: arrangeAgentic,
    scorePath: path.join(pkg, 'public/agentic/score.wav'),
    voice: { en: voiceFiles('agentic', 'en'), fr: voiceFiles('agentic', 'fr') },
  },
} satisfies Record<string, Film>;

export type FilmId = keyof typeof FILMS;

/** `--film <id>` from argv (default: showcase). */
export const filmFromArgv = (): FilmId => {
  const index = process.argv.indexOf('--film');
  const id = index === -1 ? 'showcase' : process.argv[index + 1];

  if (!(id in FILMS)) throw new Error(`Unknown film "${id}" — one of: ${Object.keys(FILMS).join(', ')}`);

  return id as FilmId;
};

// Every film language, checked against `Lang` (which Node can't import at runtime — it lives in TSX).
const LANGS = { en: true, fr: true } satisfies Record<Lang, true>;

/** `--lang <lang>` from argv (default: en). */
export const langFromArgv = (): Lang => {
  const index = process.argv.indexOf('--lang');
  const lang = index === -1 ? 'en' : process.argv[index + 1];

  if (!(lang in LANGS)) throw new Error(`Unknown language "${lang}" — one of: ${Object.keys(LANGS).join(', ')}`);

  return lang as Lang;
};
