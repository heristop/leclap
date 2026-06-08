/**
 * Pure FFmpeg argument builders for on-device compilation (ffmpeg-expo).
 *
 * Scope: the single-clip path — one recorded `project_video`, optionally trimmed, cropped, muted,
 * with a centered text overlay, scaled to the template orientation. This mirrors the spike-proven
 * command shape and the core's per-segment filters (scale + setsar, drawtext). Multi-section
 * concat / xfade transitions / music mixing are deliberately NOT here yet: those are a multi-pass
 * pipeline the core renders segment-by-segment, and each pass must be validated on-device
 * incrementally (Phase 0 gate) before being trusted. Keeping this pure makes it unit-testable
 * without a device.
 */

export const RESOLUTION: Record<'portrait' | 'landscape', { w: number; h: number }> = {
  portrait: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
};

export interface ClipEdit {
  /** Trim start in seconds (fast-seek before input). */
  trimStart?: number;
  /** Trim end in seconds. */
  trimEnd?: number;
  /** Crop rect, normalized 0..1 relative to the source frame. */
  crop?: { x: number; y: number; w: number; h: number };
}

export interface DrawtextOverlay {
  text: string;
  fontsize: number;
  fontcolor: string;
  /** Absolute path to a .ttf on device — drawtext needs a real font file (no fontconfig). */
  fontPath: string;
}

export interface SingleClipArgsInput {
  inputPath: string;
  outputPath: string;
  orientation: 'portrait' | 'landscape';
  mute?: boolean;
  edit?: ClipEdit;
  drawtext?: DrawtextOverlay;
  /** Section duration cap in seconds (used when no explicit trim end). */
  durationSec?: number;
  /** Video codec. Defaults to mpeg4 (always present in the build, proven by the spike). */
  codec?: string;
}

/**
 * Escape a string for use inside a single-quoted drawtext `text='...'` value.
 * FFmpeg drawtext treats `\`, `'`, `:`, and `%` specially.
 */
export function escapeDrawtext(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '\\%');
}

/** Build the `-vf` filterchain (crop → scale/pad → setsar → drawtext), or undefined if empty. */
function buildVideoFilter(input: SingleClipArgsInput): string | undefined {
  const { w, h } = RESOLUTION[input.orientation];
  const filters: string[] = [];

  if (input.edit?.crop) {
    const { x, y, w: cw, h: ch } = input.edit.crop;
    filters.push(`crop=iw*${cw}:ih*${ch}:iw*${x}:ih*${y}`);
  }

  // Fit into the target frame without distortion, then pad to exact size.
  filters.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease`);
  filters.push(`pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`);
  filters.push('setsar=1');

  if (input.drawtext) {
    const { text, fontsize, fontcolor, fontPath } = input.drawtext;
    filters.push(
      `drawtext=fontfile=${fontPath}:text='${escapeDrawtext(text)}':fontsize=${fontsize}:` +
        `fontcolor=${fontcolor}:x=(w-text_w)/2:y=(h-text_h)/2`
    );
  }

  return filters.length > 0 ? filters.join(',') : undefined;
}

/** Effective output duration in seconds: explicit trim window, else the section cap. */
function resolveDuration(input: SingleClipArgsInput): number | undefined {
  const { trimStart, trimEnd } = input.edit ?? {};

  if (trimStart !== undefined && trimEnd !== undefined) {
    return Math.max(0, trimEnd - trimStart);
  }

  return input.durationSec;
}

export function buildSingleClipArgs(input: SingleClipArgsInput): string[] {
  const args: string[] = ['-y'];

  // Fast-seek before -i so the trim is cheap.
  if (input.edit?.trimStart) {
    args.push('-ss', String(input.edit.trimStart));
  }

  args.push('-i', input.inputPath);

  const duration = resolveDuration(input);

  if (duration !== undefined) {
    args.push('-t', String(duration));
  }

  const vf = buildVideoFilter(input);

  if (vf) {
    args.push('-vf', vf);
  }

  if (input.mute) {
    args.push('-an');
  }

  args.push('-pix_fmt', 'yuv420p', '-c:v', input.codec ?? 'mpeg4', input.outputPath);

  return args;
}
