import { assertSafeArgToken } from '@/core/argGuard';
import type { MapAnimationInput } from '@/core/types';
import type { BackgroundLayer } from '../schemas/template.schemas';

// Pure builders for the `-i` source fragments of composited inputs (animations and gradient layers).
// They return fully-formed fragment strings (already containing `-i`, plus any `-framerate` /
// `-stream_loop` / `-c:v` flags) so SegmentBuilder can push them verbatim into the sources list.
// The path/pattern token is guarded; the surrounding flags are literals built here.

/**
 * image2 frame-sequence source for a ZIP-extracted animation:
 * `[-stream_loop -1] -framerate <fps> -i <dir>/<pattern>`.
 */
export function buildZipAnimationSource(input: MapAnimationInput, pattern: string): string {
  const loop = input.options.loop ? '-stream_loop -1 ' : '';
  const fps = input.options.fps || 25;

  return `${loop}-framerate ${fps} -i ${assertSafeArgToken(pattern, 'animation sequence')}`;
}

/**
 * Single-file animation source (`.apng`/`.webp`/`.gif`/`.webm`): `[-c:v libvpx-vp9] [-stream_loop -1] -i <path>`.
 * `.webm` gets `-c:v libvpx-vp9` BEFORE the `-i` so its alpha channel decodes.
 */
export function buildSingleFileAnimationSource(input: MapAnimationInput, path: string): string {
  const codec = /\.webm$/i.test(input.url) ? '-c:v libvpx-vp9 ' : '';
  const loop = input.options.loop ? '-stream_loop -1 ' : '';

  return `${codec}${loop}-i ${assertSafeArgToken(path, 'animation source')}`;
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
