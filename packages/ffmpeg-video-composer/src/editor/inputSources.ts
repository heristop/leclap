import { assertSafeArgToken } from '@/core/argGuard';
import type { BackgroundLayer } from '../schemas/template.schemas';

// Pure builders for the `-i` source fragments of composited inputs (animations and gradient layers).
// They return fully-formed fragment strings (already containing `-i`, plus any `-framerate` /
// `-stream_loop` / `-c:v` flags) so SegmentBuilder can push them verbatim into the sources list.
// The path/pattern token is guarded; the surrounding flags are literals built here.

/** Playback bounds for an animation overlay — see buildLoopFlags. */
type LoopOptions = { loop?: boolean; loops?: number; duration?: number; start?: number };

/**
 * Input-option flags (before `-i`) that bound WHEN and HOW LONG an animation overlay plays.
 * `start` delays the overlay via `-itsoffset` (it shows from that second on); the extent precedence is
 * `duration` > `loops` > `loop`:
 *   - duration D: `-stream_loop -1 -t D` (loop the source, then cut at D seconds).
 *   - loops N (finite): `-stream_loop {N-1}` (play N times); when a `maxDuration` ceiling is given
 *     (the whole-video pass passes the base-video length), add `-t <ceiling>` so an over-long looped
 *     overlay can't lengthen the output. N <= 1 plays once (no flag).
 *   - loop true (legacy): `-stream_loop -1` (infinite; the caller bounds it with overlay `shortest=1`).
 *   - none: play once (no flag).
 */
export function buildLoopFlags(options: LoopOptions, maxDuration?: number): string {
  const offset = options.start && options.start > 0 ? `-itsoffset ${options.start} ` : '';

  if (options.duration !== undefined) return `-stream_loop -1 ${offset}-t ${options.duration} `;

  if (options.loops !== undefined) {
    const repeat = options.loops > 1 ? `-stream_loop ${options.loops - 1} ` : '';
    const ceiling = maxDuration === undefined ? '' : `-t ${maxDuration} `;

    return `${repeat}${offset}${ceiling}`;
  }

  return options.loop ? `-stream_loop -1 ${offset}` : offset;
}

/**
 * Single-file animation source (`.apng`/`.webp`/`.gif`/`.webm`): `[-c:v libvpx-vp9] [loop flags] -i <path>`.
 * `.webm` gets `-c:v libvpx-vp9` BEFORE everything so its alpha channel decodes. The loop/duration
 * flags come from buildLoopFlags; `maxDuration` is the optional whole-video ceiling for finite loops.
 */
export function buildSingleFileAnimationSource(
  input: { url: string; options: LoopOptions },
  path: string,
  opts?: { maxDuration?: number }
): string {
  const codec = /\.webm$/i.test(input.url) ? '-c:v libvpx-vp9 ' : '';
  const flags = buildLoopFlags(input.options, opts?.maxDuration);

  return `${codec}${flags}-i ${assertSafeArgToken(path, 'animation source')}`;
}

/**
 * Filters applied to an animation leg before it is overlaid: scale it to its declared size (so `scale`
 * sizes the animation itself, not the already-composited frame), rotate it clockwise when `rotation` is
 * a nonzero angle, then fade it via colorchannelmixer when opacity < 1 (the same alpha-multiply the
 * gradient layer uses). Shared by the per-section overlay (MapManager.addAnimationOverlay) and the
 * whole-video pass (AnimationComposer) so both stay identical.
 *
 * Rotation order: scale → rotate → fade. The `rotate` runs on an `format=rgba` frame with `c=none` so
 * the corners the rotation exposes stay transparent (no black box around a rotated PNG/APNG), and
 * `ow=rotw(…)/oh=roth(…)` grow the output frame to the rotated bounds so it is never clipped.
 */
export function buildAnimationLegFilters(options: { scale?: string; rotation?: number; opacity?: number }): string[] {
  const opacity = options.opacity ?? 1;
  const rotation = options.rotation ?? 0;
  const legFilters: string[] = [];

  if (options.scale) legFilters.push(`scale=${options.scale}`, 'setsar=1');

  // rotate's `c=none` and the alpha multiply both need an alpha channel; convert to rgba once and
  // reuse it for whichever steps follow so the chain never re-formats the same frame.
  const needsAlpha = rotation !== 0 || opacity < 1;

  if (needsAlpha) legFilters.push('format=rgba');

  if (rotation !== 0) {
    const angle = `${rotation}*PI/180`;

    legFilters.push(`rotate=a=${angle}:ow=rotw(${angle}):oh=roth(${angle}):c=none`);
  }

  if (opacity < 1) legFilters.push(`colorchannelmixer=aa=${opacity}`);

  return legFilters;
}

/**
 * Still-image overlay source (`.jpg`/`.png`/`.webp`): `-loop 1 -i <path>` — the image2 demuxer holds
 * the single frame as a stream so it composites over the section for its whole duration (bounded by
 * the main video via `-shortest`), the same way an animation's `-stream_loop -1` holds it.
 */
export function buildSingleFileImageSource(path: string): string {
  return `-loop 1 -i ${assertSafeArgToken(path, 'image source')}`;
}

const GRADIENT_DIRECTION_COORDS: Record<string, string> = {
  // gradients defaults to a top→bottom (vertical) sweep; we set the end coords explicitly per direction.
  horizontal: 'x0=0:y0=0:x1=%W:y1=0',
  vertical: 'x0=0:y0=0:x1=0:y1=%H',
  diagonal: 'x0=0:y0=0:x1=%W:y1=%H',
};

/**
 * lavfi gradients source for a gradient background layer:
 * `-f lavfi -i gradients=s=<WxH>:c0=<from>:c1=<to>:d=<duration>:<direction coords>`.
 * Colors are guarded; W/H come from the (already validated) scale; duration is numeric.
 */
export function buildGradientSource(layer: BackgroundLayer, scale: string, duration: number): string {
  const gradient = layer.gradient;

  if (!gradient) {
    throw new Error('buildGradientSource called on a layer without a gradient');
  }

  const size = scale.replace(':', 'x');
  const [width, height] = size.split('x');
  const direction = gradient.direction ?? 'vertical';
  const coords = (GRADIENT_DIRECTION_COORDS[direction] ?? GRADIENT_DIRECTION_COORDS.vertical)
    .replace('%W', width)
    .replace('%H', height);

  const from = assertSafeArgToken(gradient.from, 'gradient from');
  const to = assertSafeArgToken(gradient.to, 'gradient to');

  return `-f lavfi -i gradients=s=${size}:c0=${from}:c1=${to}:d=${duration}:${coords}`;
}
