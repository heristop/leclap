import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@/index';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import { testBuildDir } from './fixtures/build-dir';

const execFileAsync = promisify(execFile);

// Real-compile proof for Task 1 (still images in the whole-video overlay path). Before this fix, a
// `.png` in global.animations decoded as ONE frame (buildSingleFileAnimationSource had no `-loop 1`
// branch) — the overlay filter's `eof_action=pass` then let the video show through for the rest of
// the render, so the image effectively vanished after a single frame. The `-loop 1` fix makes the
// source INFINITE, which introduces a new failure mode this suite specifically targets: if the
// overlay's `shortest=1` terminator were missing, the infinite input would either hang the compile
// or (were ffmpeg to pick the looping input as the "longest" stream) stretch the output past the
// joined video's own duration. Both risks are checked here with a REAL ffmpeg compile, not by
// reasoning about the filtergraph.
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const libDir = path.resolve(repoRoot, 'packages/leclap-creative-kit/src/library');
const buildDir = testBuildDir('still-image-overlay-compile');

async function ffprobeDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'quiet',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);

  return Number(stdout.trim());
}

// Average RGB brightness of a single pixel-region, sampled by cropping the region and downscaling it
// to 1x1 (ffmpeg's scale filter averages the source samples) — a cheap way to ask "is something other
// than the flat black background visible here at this time" without a pixel-perfect image comparison.
async function averageBrightness(filePath: string, atSeconds: number, crop: string): Promise<number> {
  const { stdout } = await execFileAsync(
    'ffmpeg',
    [
      '-i',
      filePath,
      '-ss',
      String(atSeconds),
      '-vf',
      `crop=${crop},scale=1:1`,
      '-vframes',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1',
    ],
    { encoding: 'buffer', maxBuffer: 1024 * 1024 }
  );
  const buf = stdout as unknown as Buffer;

  return (buf[0] + buf[1] + buf[2]) / 3;
}

describe('still image (.png) in global.animations — whole-video overlay real compile', () => {
  it("compiles rc 0, ends at the joined video's own duration, and the image is actually visible in its gated window", async () => {
    // Two 2s color_background sections, no transition — a straight concat, so the joined video's own
    // duration is exactly 4s. The still overlay is gated to [1,3) via start/duration (lowered to an
    // `enable='between(t,1,3)'` overlay gate, per imageOverlayEnable), positioned at the top-left
    // corner (0:0) over the logo.png asset so a corner crop can sample it.
    const descriptor = {
      global: {
        orientation: 'landscape',
        musicEnabled: false,
        animations: [{ url: 'pictures/logo.png', position: '0:0', start: 1, duration: 2 }],
      },
      sections: [
        { name: 'still_a', type: 'color_background', options: { backgroundColor: '#000000', duration: 2 } },
        { name: 'still_b', type: 'color_background', options: { backgroundColor: '#000000', duration: 2 } },
      ],
    } as unknown as TemplateDescriptor;

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
    expect(out, 'the still-overlay template should compile').not.toBeNull();

    const outPath = out as string;

    // The main risk of this task: an infinite `-loop 1` source without a terminator would hang the
    // compile (compile() would never have resolved above) or stretch the output past 4s. 0.15s is a
    // few-frames tolerance for encoder/concat rounding, not slack for a real duration mismatch.
    const duration = await ffprobeDuration(outPath);
    expect(duration).toBeGreaterThan(3.85);
    expect(duration).toBeLessThan(4.15);

    // Frame-level presence check: sample the logo's corner region (a part of the source image with
    // partial opacity over white, measured directly against the source asset) before, during and
    // after the [1,3) gate. Composited over pure black, "during" must be visibly brighter than the
    // flat background "before"/"after" samples — proving the image actually rendered, not just that
    // the container duration is correct.
    const crop = '120:120:120:144';
    const before = await averageBrightness(outPath, 0.3, crop);
    const during = await averageBrightness(outPath, 2.0, crop);
    const after = await averageBrightness(outPath, 3.5, crop);

    expect(before).toBeLessThan(20);
    expect(after).toBeLessThan(20);
    expect(during).toBeGreaterThan(before + 30);
    expect(during).toBeGreaterThan(after + 30);
  }, 120000);
});
