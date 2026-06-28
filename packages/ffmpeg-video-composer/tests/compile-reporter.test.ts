import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@/index';
import type { CompileReporter, ProjectConfig, TemplateDescriptor } from '@/core/types';

// The Node `compile()` accepts an optional reporter so a host (the `leclap` CLI) can render live
// progress and tee the engine's logs. This proves the wiring end to end on real ffmpeg with the
// cheapest fixture (a single color_background card — no user video, no music): the reporter must see
// monotonic 0..1 progress reaching 1 and at least one forwarded log line.
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const libDir = path.resolve(repoRoot, 'packages/leclap-creative-kit/src/library');
const fixturesDir = path.resolve(here, 'fixtures');
const buildDir = path.resolve(repoRoot, 'build/compile-reporter');

function load(id: string): TemplateDescriptor {
  return JSON.parse(fs.readFileSync(path.resolve(fixturesDir, `${id}.json`), 'utf8')) as TemplateDescriptor;
}

describe('compile() reporter', () => {
  it('forwards 0..1 progress and engine log lines', async () => {
    const descriptor = load('gradient');

    const projectConfig = {
      buildDir,
      assetsDir: libDir,
      currentLocale: 'en',
      audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
      videoConfig: { orientation: 'landscape', scale: '1280:720' },
      fields: {},
      userVideoPaths: {},
    } as unknown as ProjectConfig;

    const progress: number[] = [];
    const logs: Array<{ level: string; message: string }> = [];
    const reporter: CompileReporter = {
      onProgress: (fraction) => progress.push(fraction),
      onLog: (line) => logs.push(line),
    };

    const out = await compile(projectConfig, descriptor, reporter);

    expect(out, 'gradient should compile').not.toBeNull();

    // Progress is forwarded, stays within 0..1, never decreases, and reaches completion.
    expect(progress.length).toBeGreaterThan(0);
    expect(Math.min(...progress)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...progress)).toBeLessThanOrEqual(1);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
    }
    expect(Math.max(...progress)).toBeCloseTo(1, 5);

    // Engine log lines are teed to the reporter even though the base logger may be quiet.
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => typeof l.message === 'string' && l.message.length > 0)).toBe(true);
  }, 180000);

  it('compiles unchanged when no reporter is passed', async () => {
    const descriptor = load('gradient');
    const projectConfig = {
      buildDir,
      assetsDir: libDir,
      currentLocale: 'en',
      audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
      videoConfig: { orientation: 'landscape', scale: '1280:720' },
      fields: {},
      userVideoPaths: {},
    } as unknown as ProjectConfig;

    const out = await compile(projectConfig, descriptor);
    expect(out, 'gradient should compile without a reporter').not.toBeNull();
  }, 180000);
});
