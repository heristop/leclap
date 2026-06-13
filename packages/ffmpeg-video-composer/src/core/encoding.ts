import type { ProjectConfig } from './types';

/**
 * Pure encoder-argument helpers shared by the per-section SegmentBuilder and the final
 * transition-assembly pass in VideoEditor. Keeping them here (rather than as protected
 * SegmentBuilder methods) lets both paths honour the same hardware/codec constraints
 * without one depending on the other.
 */

/** The video encoder name for this platform — `codecConfig.videoCodec` (h264_mediacodec on device) or `h264`. */
export function resolveVideoCodec(config: ProjectConfig): string {
  // The default ProjectConfig sets videoCodec to '' (empty), so any falsy value must fall back to h264.
  const configured = config.codecConfig?.videoCodec;

  if (configured) {
    return configured;
  }

  return 'h264';
}

/** True when the selected encoder is a hardware one (h264_mediacodec / h264_videotoolbox). */
export function isHardwareCodec(config: ProjectConfig): boolean {
  const codec = resolveVideoCodec(config);

  return codec.includes('mediacodec') || codec.includes('videotoolbox');
}

/** `-pix_fmt yuv420p` for software encoders; empty for hardware (the filtergraph sets the format). */
export function buildPixFmtArg(config: ProjectConfig): string {
  return isHardwareCodec(config) ? '' : '-pix_fmt yuv420p';
}

/**
 * Full `-c:v …` args for re-encoded clips. Defaults to the software (libx264-style) settings used
 * by the server/web. When a hardware encoder (h264_mediacodec / h264_videotoolbox on device) is
 * selected, the libx264-only flags (crf/tune/profile/preset) are dropped — those encoders reject
 * them — in favour of a bitrate target. (Color/image segments use the bare `-c:v ${resolveVideoCodec()}`.)
 */
export function buildVideoEncoderArgs(config: ProjectConfig): string {
  const codec = resolveVideoCodec(config);

  if (isHardwareCodec(config)) {
    return `-c:v ${codec} -b:v 8M`;
  }

  // mpeg4 (the on-device LGPL software encoder) takes quality/bitrate, not the libx264-only flags.
  if (codec === 'mpeg4') {
    return '-c:v mpeg4 -q:v 4';
  }

  // libopenh264 (Cisco's LGPL-OK software H.264, used on-device) — bitrate-based; no libx264 flags.
  if (codec === 'libopenh264') {
    return '-c:v libopenh264 -b:v 4M -profile:v main';
  }

  return `-c:v ${codec} -crf 23 -tune film -b:v 12M -profile:v high -preset ${config.hardwareConfig?.preset ?? 'medium'}`;
}
