import { describe, expect, it } from 'vitest';
import {
  buildColorMetadataArgs,
  buildColorMetadataFilter,
  buildVideoEncoderArgs,
  usesLgplEngine,
} from '@/core/encoding';
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

describe('buildColorMetadataArgs', () => {
  // Re-encoded output must be tagged Rec.709 / limited-range so browsers decode it with the right
  // matrix — untagged H.264 from some sources is read as bt470bg/full-range and renders frozen or
  // mis-coloured in real Chrome (the malformed-tag decode bug). The filtergraph already converts to
  // yuv420p; these flags tag the colour metadata to match.
  it('tags Rec.709 limited-range colour metadata', () => {
    expect(buildColorMetadataArgs()).toBe('-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv');
  });
});

describe('buildColorMetadataFilter', () => {
  // The output flags above only set matrix + range; a malformed source's primaries/transfer leak
  // through. The setparams filter forces all four fields on the frames, encoder-agnostically, so the
  // segment overrides a bt470bg/full-range source to a clean Rec.709 tag that downstream passes inherit.
  it('forces all four colour fields to Rec.709 via setparams', () => {
    expect(buildColorMetadataFilter()).toBe(
      'setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709'
    );
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
