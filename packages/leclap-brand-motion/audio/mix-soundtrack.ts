// Mix a film's final soundtrack offline: the score, ducked under the narration with the exact curve the
// composition uses (src/film/ducking.ts), plus every voice line at its start. Replaces Remotion's
// audio-only render pass, which re-evaluates every frame of the picture just to collect two audio
// tracks — slow, and on a busy machine it hangs on video frame fetches.
//   node audio/mix-soundtrack.ts --film agentic → out/<film>-soundtrack.wav (also used by render-film.ts)
//   … --lang fr                                 → out/<film>-soundtrack.fr.wav, over the French narration
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NARRATION } from '../src/film/narration.ts';
import type { Lang } from '../src/film/lang.tsx';
import { scoreVolumeAt } from '../src/film/ducking.ts';
import { FILMS, type FilmId, filmFromArgv, langFromArgv, langSuffix } from './films.ts';

const SR = 48000;
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../public');

interface Pcm {
  left: Float32Array;
  right: Float32Array;
}

/** Read a 16-bit PCM stereo 48 kHz WAV (what generate-score and generate-voice write). */
const readWav = (file: string): Pcm => {
  const buffer = readFileSync(file);
  const channels = buffer.readUInt16LE(22);
  const rate = buffer.readUInt32LE(24);
  const bits = buffer.readUInt16LE(34);

  if (channels !== 2 || rate !== SR || bits !== 16) throw new Error(`${file}: expected 16-bit stereo ${SR} Hz`);

  // Walk the chunks to "data" (sox may write extra chunks before it).
  let offset = 12;

  while (buffer.toString('ascii', offset, offset + 4) !== 'data') offset += 8 + buffer.readUInt32LE(offset + 4);

  const bytes = buffer.readUInt32LE(offset + 4);
  const frames = bytes / 4;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);

  for (let i = 0; i < frames; i += 1) {
    left[i] = buffer.readInt16LE(offset + 8 + i * 4) / 32768;
    right[i] = buffer.readInt16LE(offset + 10 + i * 4) / 32768;
  }

  return { left, right };
};

const writeWav = (file: string, { left, right }: Pcm): void => {
  const frames = left.length;
  const buffer = Buffer.alloc(44 + frames * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + frames * 4, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(frames * 4, 40);

  for (let i = 0; i < frames; i += 1) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }

  writeFileSync(file, buffer);
};

/** Mix `fromSeconds`–`toSeconds` of the film's `lang` cut (narrated per NARRATION) into `out`. */
export const mixSoundtrack = (
  film: FilmId,
  lang: Lang,
  out: string,
  fromSeconds = 0,
  toSeconds = FILMS[film].duration
): void => {
  const { scorePath } = FILMS[film];
  const { manifestPath } = FILMS[film].voice[NARRATION[lang]];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    lines: { start: number; duration: number; file: string }[];
  };
  const frames = Math.round((toSeconds - fromSeconds) * SR);
  const mix: Pcm = { left: new Float32Array(frames), right: new Float32Array(frames) };
  const score = readWav(scorePath);

  for (let i = 0; i < frames; i += 1) {
    const source = i + Math.round(fromSeconds * SR);
    const gain = scoreVolumeAt(source / SR, manifest.lines);
    mix.left[i] = (score.left[source] ?? 0) * gain;
    mix.right[i] = (score.right[source] ?? 0) * gain;
  }

  for (const line of manifest.lines) {
    const voice = readWav(path.join(publicDir, line.file));
    const at = Math.round((line.start - fromSeconds) * SR);

    for (let i = 0; i < voice.left.length; i += 1) {
      if (at + i >= 0 && at + i < frames) {
        mix.left[at + i] += voice.left[i];
        mix.right[at + i] += voice.right[i];
      }
    }
  }

  writeWav(out, mix);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const film = filmFromArgv();
  const lang = langFromArgv();
  const out = path.resolve(here, `../out/${film}-soundtrack${langSuffix(lang)}.wav`);
  mixSoundtrack(film, lang, out);
  console.log(`Mixed ${path.relative(process.cwd(), out)}`);
}
