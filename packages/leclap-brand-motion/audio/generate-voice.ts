// Render a film's narration, then shape it for picture.
//   node audio/generate-voice.ts                  (the showcase; --film agentic for the agentic film)
//   LECLAP_VOICE=am_michael node audio/generate-voice.ts             (another Kokoro voice)
//   LECLAP_TTS=say LECLAP_VOICE=Daniel node audio/generate-voice.ts  (macOS fallback)
// Every cut is narrated in English (src/film/narration.ts); --lang fr still reads the French text, with
// Kokoro's ff_siwis, should a French narration ever come back.
//
// Two engines:
//   • kokoro (default when installed) — Kokoro-82M, a local neural TTS, run through audio/kokoro-tts.py
//     in the venv at ~/.cache/leclap-tts (override with LECLAP_KOKORO_HOME). One process renders the
//     whole batch, so the model loads once. Setup: see storyboard.md → Sound.
//   • say — the macOS speech synthesiser. Thin and robotic next to Kokoro; kept as a fallback.
//
// Each line of the film's voice-lines.ts becomes public/<film>/voice/<id>.wav (voice-fr/ in French),
// shaped by sox (rumble cut, gentle compression, a short room, same peak for every line). A line that
// runs into the next one's start is re-read faster rather than trimmed. The measured durations land in
// the film's voice-manifest.json (voice-manifest.fr.json); the composition ducks the score under exactly
// those windows.
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Lang } from '../src/film/lang.tsx';
import type { VoiceLine } from '../src/showcase/voice-lines.ts';
import { FILMS, filmFromArgv, langFromArgv } from './films.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const film = FILMS[filmFromArgv()];
const lang = langFromArgv();
const VOICE_LINES = film.lines;
const DURATION = film.duration;
const { dir: outDir, manifestPath, publicPath } = film.voice[lang];

const KOKORO_HOME = process.env.LECLAP_KOKORO_HOME ?? path.join(os.homedir(), '.cache', 'leclap-tts');
const KOKORO = {
  python: path.join(KOKORO_HOME, 'venv', 'bin', 'python'),
  model: path.join(KOKORO_HOME, 'kokoro-v1.0.onnx'),
  voices: path.join(KOKORO_HOME, 'voices-v1.0.bin'),
  script: path.resolve(here, 'kokoro-tts.py'),
};
const kokoroInstalled = existsSync(KOKORO.python) && existsSync(KOKORO.model) && existsSync(KOKORO.voices);

type Engine = 'kokoro' | 'say';

const ENGINE: Engine = (process.env.LECLAP_TTS as Engine | undefined) ?? (kokoroInstalled ? 'kokoro' : 'say');

/** Each language's narrator, per engine. */
const NARRATORS = {
  en: { kokoro: 'af_heart', say: 'Daniel' },
  fr: { kokoro: 'ff_siwis', say: 'Thomas' },
} satisfies Record<Lang, Record<Engine, string>>;

const VOICE = process.env.LECLAP_VOICE ?? NARRATORS[lang][ENGINE];

/** The language espeak phonemizes with for Kokoro (British voices start with `b`). */
const kokoroLang = (): string => {
  if (lang === 'fr') return 'fr-fr';

  return VOICE.startsWith('b') ? 'en-gb' : 'en-us';
};

/**
 * Reading speeds tried in turn when a line overruns its slot (Kokoro speed factor / `say` wpm). French
 * stops at 1.12 — faster, Kokoro's French starts to sound rushed; a line that still overruns needs
 * tighter wording.
 */
const SPEEDS: Record<Engine, Record<Lang, readonly number[]>> = {
  kokoro: { en: [1, 1.08, 1.16, 1.24], fr: [1, 1.04, 1.08, 1.12] },
  say: { en: [168, 176, 184, 192, 200], fr: [168, 176, 184, 192, 200] },
};

/** A line's speed on rung `step`: never below the line's own Kokoro `speed` for this language. */
const speedAt = (line: VoiceLine, step: number): number => {
  const rung = SPEEDS[ENGINE][lang][step];

  if (ENGINE === 'say') return rung;

  return Math.max(line.speed?.[lang] ?? 1, rung);
};

/** What the engine reads: the line in this language (`say` has its own English respelling). */
const textOf = (line: VoiceLine): string => {
  if (ENGINE === 'say' && lang === 'en') return line.say ?? line.text.en;

  return line.text[lang];
};

/** Breathing room kept between the end of one line and the start of the next. */
const GAP = 0.2;

// The shaping chain. Kokoro is already clean and full, so it gets a lighter touch than `say`; its
// leading/trailing silence is trimmed so every line starts exactly on its cue.
const KOKORO_CHAIN: readonly string[] = [
  'silence',
  '1',
  '0.02',
  '-50d',
  'reverse',
  'silence',
  '1',
  '0.02',
  '-50d',
  'reverse',
  'highpass',
  '70',
  'bass',
  '+2',
  '150',
  'compand',
  '0.02,0.25',
  '-60,-60,-30,-18,-10,-8,0,-5',
  '-3',
  '-90',
  '0.05',
  'reverb',
  '10',
  '50',
  '30',
  '100',
  '0',
  '0',
  'norm',
  '-2',
];

const SOX_CHAIN: Record<Engine, readonly string[]> = {
  kokoro: KOKORO_CHAIN,
  say: [
    'highpass',
    '90',
    'bass',
    '+4',
    '160',
    'treble',
    '+2',
    '5000',
    'compand',
    '0.01,0.18',
    '-70,-70,-40,-24,-20,-12,0,-6',
    '-4',
    '-90',
    '0.05',
    'reverb',
    '14',
    '40',
    '35',
    '100',
    '0',
    '0',
    'norm',
    '-2',
  ],
};

interface ManifestEntry {
  id: string;
  start: number;
  duration: number;
  file: string;
}

interface Fit {
  duration: number;
  speed: number;
}

const budgetFor = (index: number): number => {
  const end = index + 1 < VOICE_LINES.length ? VOICE_LINES[index + 1].start : DURATION;

  return end - VOICE_LINES[index].start - GAP;
};

const durationOf = (file: string): number => Number(execFileSync('soxi', ['-D', file]).toString().trim());

const rawPath = (line: VoiceLine): string => path.resolve(outDir, `${line.id}.raw.wav`);
const finalPath = (line: VoiceLine): string => path.resolve(outDir, `${line.id}.wav`);

/** Shape a raw read into the final 48 kHz stereo line and return its duration. */
const shape = (line: VoiceLine): number => {
  execFileSync('sox', [
    '-G',
    rawPath(line),
    '-r',
    '48000',
    '-c',
    '2',
    '-b',
    '16',
    finalPath(line),
    ...SOX_CHAIN[ENGINE],
  ]);
  rmSync(rawPath(line), { force: true });

  return durationOf(finalPath(line));
};

/** Read a batch of lines on one rung of the speed ladder with the configured engine (raw output, unshaped). */
const read = (lines: readonly VoiceLine[], step: number): void => {
  if (ENGINE === 'say') {
    for (const line of lines) {
      const aiff = rawPath(line).replace(/\.wav$/, '.aiff');
      execFileSync('say', ['-v', VOICE, '-r', String(speedAt(line, step)), '-o', aiff, textOf(line)]);
      execFileSync('sox', [aiff, rawPath(line)]);
      rmSync(aiff, { force: true });
    }

    return;
  }

  const job = {
    model: KOKORO.model,
    voices: KOKORO.voices,
    voice: VOICE,
    lang: kokoroLang(),
    lines: lines.map((line) => ({ id: line.id, text: textOf(line), speed: speedAt(line, step), out: rawPath(line) })),
  };

  execFileSync(KOKORO.python, [KOKORO.script], { input: JSON.stringify(job), stdio: ['pipe', 'ignore', 'inherit'] });
};

/**
 * Read every line, then re-read only the overrunning ones one speed step faster, until everything
 * fits or the fastest speed is reached. Returns each line's final duration and speed.
 */
const fitAll = (pending: readonly VoiceLine[], step = 0, results = new Map<string, Fit>()): Map<string, Fit> => {
  read(pending, step);

  for (const line of pending) results.set(line.id, { duration: shape(line), speed: speedAt(line, step) });

  const overruns = pending.filter(
    (line) => (results.get(line.id)?.duration ?? 0) > budgetFor(VOICE_LINES.indexOf(line))
  );

  if (overruns.length === 0 || step + 1 >= SPEEDS[ENGINE][lang].length) return results;

  return fitAll(overruns, step + 1, results);
};

if (ENGINE === 'kokoro' && !kokoroInstalled) {
  throw new Error(
    `Kokoro isn't installed under ${KOKORO_HOME} — see storyboard.md (Sound), or run with LECLAP_TTS=say.`
  );
}

mkdirSync(outDir, { recursive: true });
const results = fitAll(VOICE_LINES);

const manifest: ManifestEntry[] = VOICE_LINES.map((line, index) => {
  const { duration, speed } = results.get(line.id) ?? { duration: 0, speed: 0 };
  const budget = budgetFor(index);
  const flag = duration > budget ? `  ⚠ overruns by ${(duration - budget).toFixed(2)}s` : '';

  console.log(`${line.id}  @${line.start.toFixed(1)}s  ${duration.toFixed(2)}s  speed ${speed}${flag}`);

  return {
    id: line.id,
    start: line.start,
    duration: Number(duration.toFixed(3)),
    file: `${publicPath}/${line.id}.wav`,
  };
});

writeFileSync(manifestPath, `${JSON.stringify({ voice: `${ENGINE}:${VOICE}`, lines: manifest }, null, 2)}\n`);
console.log(`Wrote ${manifest.length} lines (${ENGINE}: ${VOICE}) → ${path.relative(process.cwd(), manifestPath)}`);
