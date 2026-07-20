import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@/index';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';

const execFileAsync = promisify(execFile);

// Real-compile proof for Task 2 (global.watermark descriptor sugar). watermarkToAnimation's pure unit
// tests (tests/watermark.test.ts) prove the lowering produces the right corner-expression STRING; this
// suite proves that string actually reaches ffmpeg's `overlay=` filter option UNESCAPED and renders in
// the right place. The bottom-right corner is deliberately picked (not top-left/"0:0", which every
// other overlay fixture already exercises): its expression, `W-w-<margin>:H-h-<margin>`, is real ffmpeg
// arithmetic (frame size minus overlay size minus margin) that would silently degrade to a literal,
// wrong position if AnimationComposer's static positional form ever grew quoting around `anim.position`.
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const libDir = path.resolve(repoRoot, 'packages/leclap-creative-kit/src/library');
const buildDir = path.resolve(repoRoot, 'build/watermark-compile');
// A per-file build dir so this suite's second describe block (the fused-path fixture compile) never
// shares build/output.mp4 with the bottom-right corner test above (both would otherwise race on the
// same finalVideo path if vitest ever ran them concurrently within this file).
const fusedBuildDir = path.resolve(repoRoot, 'build/watermark-compile-fused');
const fixturesDir = path.resolve(here, 'fixtures');

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

// Average RGB brightness of a cropped region at a given time, via crop+scale=1:1 (ffmpeg averages the
// source samples into the single output pixel) — the same probe technique Task 1 used, here applied to
// a whole bounding box (rather than a hand-picked bright sub-region of the source image) so the proof
// doesn't depend on which part of logo.png happens to be opaque.
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

describe('global.watermark — bottom-right corner real compile', () => {
  it("composites the watermark at the computed bottom-right position, unescaped, for the whole video's duration", async () => {
    // Two 2s color_background sections, no transition -> a straight concat, joined video is exactly 4s.
    // scale 0.15 * 1280 (output width) = 192px wide; margin 20 -> the watermark's bounding box is
    // x:[1068,1260] y:[~482,700] in the 1280x720 frame. watermarkToAnimation has no start/duration, so
    // (per the lowering) the overlay spans the whole joined video with no enable gate.
    const descriptor = {
      global: {
        orientation: 'landscape',
        musicEnabled: false,
        watermark: { url: 'pictures/logo.png', position: 'bottom-right', scale: 0.15, opacity: 0.9, margin: 20 },
      },
      sections: [
        { name: 'watermark_a', type: 'color_background', options: { backgroundColor: '#000000', duration: 2 } },
        { name: 'watermark_b', type: 'color_background', options: { backgroundColor: '#000000', duration: 2 } },
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
    expect(out, 'the watermark template should compile').not.toBeNull();

    const outPath = out as string;

    // The watermark has no start/duration, so it must not shorten/lengthen the joined video either
    // (still shares the same shortest=1 terminator every still overlay needs, per Task 1).
    const duration = await ffprobeDuration(outPath);
    expect(duration).toBeGreaterThan(3.85);
    expect(duration).toBeLessThan(4.15);

    // A crop safely INSIDE the computed bottom-right bounding box (a few px margin on every side to
    // absorb scale-filter rounding), vs. a same-size crop in the top-left, far from the watermark and
    // guaranteed pure background black at every sampled time.
    const watermarkCrop = '170:195:1075:490';
    const backgroundCrop = '170:195:20:20';

    for (const atSeconds of [0.3, 2.0, 3.5]) {
      const watermarkRegion = await averageBrightness(outPath, atSeconds, watermarkCrop);
      const backgroundRegion = await averageBrightness(outPath, atSeconds, backgroundCrop);

      expect(backgroundRegion, `background must stay black at t=${atSeconds}`).toBeLessThan(5);
      // If the position expression were mis-escaped/quoted into a literal string (or dropped, defaulting
      // to 0:0), the watermark would render at the TOP-LEFT instead — exactly where backgroundRegion is
      // sampled — so this assertion also rules out that specific failure mode, not just "no overlay at all".
      expect(
        watermarkRegion,
        `watermark region should be visibly brighter than pure background at t=${atSeconds}`
      ).toBeGreaterThan(backgroundRegion + 15);
    }
  }, 120000);
});

// Real-compile proof for the FUSED path: the corner-position test above has no section transition, so
// it only exercises the standalone post-concat overlay pass (VideoEditor.overlayAnimations). The fixture
// this test loads has a transition on its first section, which routes global.watermark's infinite
// `-loop 1` source into VideoEditor.assembleWithTransitions instead — the xfade+overlay filtergraph is
// woven into ONE re-encode with no output `-t` of its own, so an incorrectly-terminated infinite source
// there would hang the whole compile rather than just mis-render a frame. Proves the fused command
// terminates and settles at the xfade-shortened duration (2s + 2s sections, 0.5s fade -> 3.5s), not the
// unfused 4s a missed shortest=1 (or an accidental duration stretch) would produce.
describe('global.watermark — fused transition path (fixture) real compile', () => {
  it('terminates and settles at the xfade-shortened duration instead of hanging or stretching', async () => {
    const descriptor = JSON.parse(
      fs.readFileSync(path.resolve(fixturesDir, 'watermark.json'), 'utf8')
    ) as TemplateDescriptor;

    const projectConfig = {
      buildDir: fusedBuildDir,
      assetsDir: libDir,
      currentLocale: 'en',
      audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
      videoConfig: { orientation: 'landscape', scale: '1280:720' },
      fields: {},
      userVideoPaths: {},
    } as unknown as ProjectConfig;

    const out = await compile(projectConfig, descriptor);
    expect(out, 'the fused watermark+transition fixture should compile').not.toBeNull();

    // 2s + 2s sections minus the 0.5s fade overlap = 3.5s. A hang would time out the test; a missed
    // shortest=1 on the still's infinite -loop 1 source, or a mis-applied maxDuration ceiling, would
    // instead show up as a wrong (stretched or truncated) duration here.
    const duration = await ffprobeDuration(out as string);
    expect(duration).toBeGreaterThan(3.35);
    expect(duration).toBeLessThan(3.65);
  }, 120000);
});
