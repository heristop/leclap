import type { GlobalAnimation, TemplateDescriptorGlobal, Watermark, WatermarkPosition } from '@/core/types';
import { parseScale } from './motion';

// Pure lowering for the `global.watermark` descriptor sugar. It turns the small, presentation-only
// watermark shape into the SAME GlobalAnimation object a `global.animations` entry uses, so every
// downstream stage — AnimationComposer staging/fusion, buildOverlayGraph, buildAnimationLegFilters —
// is reused untouched. This file is the only place that knows the corner expressions and defaults.

const DEFAULT_POSITION: WatermarkPosition = 'bottom-right';
const DEFAULT_SCALE = 0.12;
const DEFAULT_OPACITY = 0.8;
const DEFAULT_MARGIN = 24;

// x:y overlay position expressions in ffmpeg's overlay-filter variables: W/H are the output frame's
// size, w/h are the (already-scaled) overlay leg's size. These reach `overlay=` UNESCAPED —
// AnimationComposer.buildOverlayGraph's static positional form splices `anim.position` directly into
// the filter_complex string (`anim.position ?? '0:0'`), with no quoting layer around it (the named
// `x='...':y='...'` form is used only for a MOVING `motion` entrance, which a watermark never sets) —
// so plain arithmetic like `W-w-24:H-h-24` works exactly as ffmpeg's overlay filter expects. Verified
// against a real compile (see tests/watermark-compile.test.ts) rather than assumed.
const POSITION_EXPRESSIONS: Record<WatermarkPosition, (margin: number) => string> = {
  'top-left': (m) => `${m}:${m}`,
  'top-right': (m) => `W-w-${m}:${m}`,
  'bottom-left': (m) => `${m}:H-h-${m}`,
  'bottom-right': (m) => `W-w-${m}:H-h-${m}`,
};

/**
 * Lowers a `global.watermark` descriptor into a `GlobalAnimation` entry. `outputScale` is the
 * project's "W:H" output scale (e.g. '1280:720'); the watermark's `scale` — a fraction of output
 * WIDTH — resolves against it into a pixel width emitted as "<px>:-1" so the trailing -1 preserves the
 * source image's own aspect ratio through the scale filter (same convention as every other overlay
 * scale in this engine).
 *
 * No `loop`/`persistent` flags are set: Task 1's `isStillAnimationUrl` detection already treats any
 * still raster image url (.png/.jpg/.jpeg) as an infinite `-loop 1` source with a `shortest=1`
 * terminator regardless of these flags, so a watermark image needs neither.
 */
export function watermarkToAnimation(watermark: Watermark, outputScale: string): GlobalAnimation {
  const { w } = parseScale(outputScale);
  const scale = watermark.scale ?? DEFAULT_SCALE;
  const margin = watermark.margin ?? DEFAULT_MARGIN;
  const position = watermark.position ?? DEFAULT_POSITION;
  const px = Math.round(w * scale);

  return {
    url: watermark.url,
    position: POSITION_EXPRESSIONS[position](margin),
    scale: `${px}:-1`,
    opacity: watermark.opacity ?? DEFAULT_OPACITY,
  };
}

/**
 * True when the template has any whole-video overlay work to do — an explicit `global.animations`
 * entry, or a `global.watermark` that lowers into one via `watermarkToAnimation`. Three call sites
 * outside AnimationComposer decide whether to run the overlay pass at ALL, before AnimationComposer
 * ever sees the descriptor: VideoEditor.stageOverlaysForFusion, VideoEditor.overlayAnimations, and
 * TemplateDirector's concat-fold `hasAnimations` gate (finalize-concat-fold.ts) — the last one is the
 * highest-stakes: if it disagreed, a watermark-only template with music/normalize and no transitions
 * would fold the concat pass and skip the overlay stage entirely, silently never rendering the
 * watermark. All three must agree with AnimationComposer's own prepend, hence this single shared check.
 */
export function hasWholeVideoOverlays(global: TemplateDescriptorGlobal | undefined): boolean {
  return (global?.animations?.length ?? 0) > 0 || Boolean(global?.watermark);
}
