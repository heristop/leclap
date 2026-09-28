import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compile } from '@/index';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import { testBuildDir } from './fixtures/build-dir';

const execFileAsync = promisify(execFile);

// Real-compile proof that looping a short track never rewrites the track itself. MusicComposer resolves
// `global.music` to wherever the track already lives — the caller's assets dir (the CLI's <cwd>/assets,
// the MCP's read-only media library) or the package's own bundled library — and the loop used to be
// renamed over that path: a 1.5s mp3 under a 3.5s video came back as a ~4.5s MP4 still named .mp3, and
// the next render, finding a track long enough already, stopped looping it. The track is generated here
// because every library track outlasts any video a test renders, and those are tracked files.
const TRACK_SECONDS = 1.5;
const VIDEO_SECONDS = 3.5;

async function sha256(filePath: string): Promise<string> {
  return createHash('sha256')
    .update(await fs.readFile(filePath))
    .digest('hex');
}

// Mean loudness of the audio in [start, start + duration], parsed from volumedetect's stderr report.
async function meanVolumeDb(filePath: string, start: number, duration: number): Promise<number> {
  const { stderr } = await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-ss',
    String(start),
    '-t',
    String(duration),
    '-i',
    filePath,
    '-vn',
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ]);
  const match = stderr.match(/mean_volume: (-?[\d.]+) dB/);

  return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
}

describe('music loop — real compile', () => {
  let assetsDir: string;
  let trackPath: string;

  beforeAll(async () => {
    assetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fvc-music-loop-'));
    await fs.mkdir(path.join(assetsDir, 'musics'));
    trackPath = path.join(assetsDir, 'musics', 'short-tone.mp3');
    await execFileAsync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:duration=${TRACK_SECONDS}`,
      '-c:a',
      'libmp3lame',
      trackPath,
    ]);
  });

  afterAll(async () => {
    await fs.rm(assetsDir, { recursive: true, force: true });
  });

  it('mixes a looped copy of a short track and leaves the track in the assets dir byte-identical', async () => {
    const original = await sha256(trackPath);
    const descriptor = {
      global: { orientation: 'landscape', musicEnabled: true, music: { name: 'short-tone' } },
      sections: [
        {
          name: 'music_loop',
          type: 'color_background',
          options: { backgroundColor: '#000000', duration: VIDEO_SECONDS },
        },
      ],
    } as unknown as TemplateDescriptor;
    const projectConfig = {
      buildDir: testBuildDir('music-loop-compile'),
      assetsDir,
      currentLocale: 'en',
      audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
      videoConfig: { orientation: 'landscape', scale: '640:360' },
      fields: {},
      userVideoPaths: {},
    } as unknown as ProjectConfig;

    const output = await compile(projectConfig, descriptor);

    expect(output, 'the template should compile').not.toBeNull();
    expect(await sha256(trackPath), 'the source track must come out of the render unchanged').toBe(original);
    // Past the source's own end, only a looped copy can still be sounding: the section's audio is a silent
    // anullsrc bed, and amix pads an input that has run out with silence (volumedetect reports ~-91 dB).
    expect(await meanVolumeDb(output as string, TRACK_SECONDS + 0.5, 1)).toBeGreaterThan(-50);
  }, 60000);
});
