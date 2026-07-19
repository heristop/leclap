import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { GlobalConfigSchema } from '@/schemas/global.schemas';
import { compile } from '@/index';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';

const execFileAsync = promisify(execFile);

// Reads back the actual encoded frame rate so this test catches a fps that's accepted by the schema
// and resolved into videoConfig but never reaches the ffmpeg command line (e.g. a per-segment builder
// still hardcoding its own `-r`) — a single-segment, no-transition compile stream-copies through the
// final assembly, so only the segment's OWN `-r` determines the output's real frame rate.
async function readFps(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'quiet',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=r_frame_rate',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const [num, den] = stdout.trim().split('/').map(Number);

  return den ? num / den : num;
}

describe('global.fps', () => {
  it('accepts an integer fps within range', () => {
    expect(GlobalConfigSchema.safeParse({ fps: 24 }).success).toBe(true);
    expect(GlobalConfigSchema.safeParse({ fps: 60 }).success).toBe(true);
  });

  it('rejects non-positive, fractional and out-of-range fps', () => {
    expect(GlobalConfigSchema.safeParse({ fps: 0 }).success).toBe(false);
    expect(GlobalConfigSchema.safeParse({ fps: -25 }).success).toBe(false);
    expect(GlobalConfigSchema.safeParse({ fps: 23.976 }).success).toBe(false);
    expect(GlobalConfigSchema.safeParse({ fps: 121 }).success).toBe(false);
  });
});

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const buildDir = path.resolve(repoRoot, 'build/global-fps-test');

describe('global.fps end-to-end', () => {
  it('compiles a color card at 24 fps', async () => {
    const descriptor: TemplateDescriptor = {
      global: { orientation: 'landscape', fps: 24, musicEnabled: false },
      sections: [
        {
          name: 'card',
          type: 'color_background',
          options: { duration: 1, backgroundColor: '#204060' },
        },
      ],
    } as TemplateDescriptor;

    const projectConfig = {
      buildDir,
      assetsDir: buildDir,
      currentLocale: 'en',
      audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
      videoConfig: { orientation: 'landscape', scale: '1280:720' },
    } as unknown as ProjectConfig;

    const out = await compile(projectConfig, descriptor);
    expect(out).not.toBeNull();

    const fps = await readFps(out as string);
    expect(fps).toBe(24);
  }, 120000);
});
