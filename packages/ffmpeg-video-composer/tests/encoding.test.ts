import { describe, expect, it } from 'vitest';
import { buildVideoEncoderArgs, usesLgplEngine } from '@/core/encoding';
import type { ProjectConfig } from '@/core/types';

const config = (videoCodec: string): ProjectConfig =>
  ({ codecConfig: { videoCodec, audioCodec: 'aac' } }) as unknown as ProjectConfig;

describe('buildVideoEncoderArgs', () => {
  // OpenH264 only encodes Constrained Baseline. `-profile:v main`/`high` is rejected by the device's
  // static openh264 (Android), so the libopenh264 args must never carry a profile flag.
  it('encodes libopenh264 without a -profile flag (Constrained Baseline only)', () => {
    const args = buildVideoEncoderArgs(config('libopenh264'));

    expect(args).toBe('-c:v libopenh264 -b:v 4M');
    expect(args).not.toContain('-profile:v');
  });

  it('encodes mpeg4 with quality, no libx264 flags', () => {
    expect(buildVideoEncoderArgs(config('mpeg4'))).toBe('-c:v mpeg4 -q:v 4');
  });

  it('drops libx264-only flags for hardware encoders', () => {
    expect(buildVideoEncoderArgs(config('h264_videotoolbox'))).toBe('-c:v h264_videotoolbox -b:v 8M');
  });
});

describe('usesLgplEngine', () => {
  it('is true for the on-device encoders', () => {
    for (const codec of ['libopenh264', 'mpeg4', 'h264_mediacodec', 'h264_videotoolbox']) {
      expect(usesLgplEngine(config(codec))).toBe(true);
    }
  });

  it('is false for the GPL software default', () => {
    expect(usesLgplEngine(config('h264'))).toBe(false);
  });
});
