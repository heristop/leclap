#!/usr/bin/env node
// Synthesize the bundled sound-effect library (src/library/sfx/*.m4a) from FFmpeg lavfi sources: seeded
// noise, swept sines and envelopes, so every file is original, license-free and reproducible from this
// script. Each sound is peak-normalised to PEAK_DBFS, then encoded as AAC (48 kHz stereo) in an .m4a
// container, which every backend decodes (the on-device build enables the mov demuxer and aac decoder).
// Run with `pnpm --dir packages/leclap-creative-kit gen:sfx` (needs ffmpeg on PATH). The manifest the
// engine reads (ids, durations, anchors, guidance) lives in ffmpeg-video-composer core/audio/sfx-library.ts.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../src/library/sfx');
const RATE = 48000;
const PEAK_DBFS = -3;

interface SfxRecipe {
  id: string;
  /** A lavfi filtergraph ending in the label [a]. */
  graph: string;
}

const noise = (d: number, color: string, seed: number, amp = 0.8): string =>
  `anoisesrc=d=${d}:c=${color}:r=${RATE}:a=${amp}:s=${seed}`;
const tone = (d: number, expr: string): string => `aevalsrc='${expr}':s=${RATE}:d=${d}`;

const RECIPES: SfxRecipe[] = [
  {
    id: 'whoosh',
    graph:
      `${noise(0.6, 'pink', 7)},highpass=f=300,lowpass=f=5000,` +
      'afade=t=in:d=0.32:curve=qsin,afade=t=out:st=0.32:d=0.28:curve=qsin[a]',
  },
  {
    id: 'swoosh-short',
    graph:
      `${noise(0.3, 'white', 11, 0.6)},highpass=f=900,lowpass=f=8000,` +
      'afade=t=in:d=0.12:curve=qsin,afade=t=out:st=0.12:d=0.18:curve=exp[a]',
  },
  {
    id: 'hit',
    graph:
      `${tone(0.5, 'sin(2*PI*(55*t+140*(1-exp(-30*t))/30))*exp(-7*t)')}[body];` +
      `${noise(0.5, 'white', 3, 0.5)},lowpass=f=2500,afade=t=out:d=0.06[snap];` +
      '[body][snap]amix=inputs=2:normalize=0,afade=t=out:st=0.35:d=0.15[a]',
  },
  {
    id: 'boom',
    graph:
      `${tone(1.2, 'sin(2*PI*(38*t+90*(1-exp(-9*t))/9))*exp(-3.2*t)')}[body];` +
      `${noise(1.2, 'brown', 5, 0.7)},lowpass=f=400,afade=t=out:d=0.5:curve=exp[rumble];` +
      '[body][rumble]amix=inputs=2:normalize=0,afade=t=out:st=0.9:d=0.3[a]',
  },
  {
    id: 'riser',
    graph:
      `${tone(2, '0.5*sin(2*PI*(180*t+60*(exp(1.8*t)-1)))*(t/2)^2')}[sweep];` +
      `${noise(2, 'white', 13, 0.4)},highpass=f=2500,afade=t=in:d=1.9:curve=exp[air];` +
      '[sweep][air]amix=inputs=2:normalize=0,afade=t=out:st=1.97:d=0.03[a]',
  },
  {
    id: 'click',
    graph: `${noise(0.05, 'white', 17, 0.9)},highpass=f=2000,afade=t=out:d=0.05:curve=exp[a]`,
  },
  {
    id: 'tick',
    graph: `${tone(0.06, 'sin(2*PI*2100*t)*exp(-90*t)')}[a]`,
  },
  {
    id: 'pop',
    graph: `${tone(0.15, 'sin(2*PI*(320*t+400*t*t/0.15))*exp(-28*t)*min(1,t*400)')}[a]`,
  },
  {
    id: 'shutter',
    graph:
      `${noise(0.08, 'white', 19, 0.9)},bandpass=f=3200:t=h:w=2400,afade=t=out:d=0.08:curve=exp[open];` +
      `${noise(0.14, 'white', 23, 0.8)},bandpass=f=2600:t=h:w=2000,afade=t=out:d=0.14:curve=exp,adelay=110|110[close];` +
      '[open][close]amix=inputs=2:normalize=0:duration=longest[a]',
  },
  {
    id: 'ding',
    graph:
      tone(1.5, '(sin(2*PI*1318.5*t)+0.3*sin(2*PI*2637*t)+0.1*sin(2*PI*3955.5*t))*exp(-3*t)*min(1,t*300)') +
      ',afade=t=out:st=1.2:d=0.3[a]',
  },
];

// FFmpeg reports on stderr; returned whole so volumedetect's peak can be read from it.
function ffmpeg(args: string[]): string {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr}`);
  }

  return result.stderr;
}

function measurePeak(wav: string): number {
  const report = ffmpeg(['-i', wav, '-af', 'volumedetect', '-f', 'null', '-']);
  const match = /max_volume: (-?[\d.]+) dB/.exec(report);

  return match ? Number(match[1]) : 0;
}

function render(recipe: SfxRecipe): void {
  const raw = path.join(outDir, `${recipe.id}.raw.wav`);
  const out = path.join(outDir, `${recipe.id}.m4a`);

  ffmpeg(['-y', '-filter_complex', recipe.graph, '-map', '[a]', '-ac', '2', '-c:a', 'pcm_s16le', raw]);
  const gain = (PEAK_DBFS - measurePeak(raw)).toFixed(2);
  const level = ['-af', `volume=${gain}dB`, '-ar', String(RATE), '-ac', '2'];
  const encode = [
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-map_metadata',
    '-1',
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
  ];

  ffmpeg(['-y', '-i', raw, ...level, ...encode, out]);
  rmSync(raw);
  console.log(`wrote ${out} (gain ${gain} dB)`);
}

mkdirSync(outDir, { recursive: true });

for (const recipe of RECIPES) render(recipe);
