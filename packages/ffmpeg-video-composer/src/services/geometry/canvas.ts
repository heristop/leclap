import DefaultConfig from '@/core/default.config';
import type { Canvas } from './geometry-types';

// From the engine's own scale constants; portrait is the landscape preset transposed, exactly what
// TemplateDirector does with `DefaultConfig.SCALE`.
function canvasFromScale(scale: string, transpose = false): Canvas {
  const [width, height] = scale.split(':').map(Number);

  return transpose ? { width: height, height: width } : { width, height };
}

const CANVASES: Record<string, Canvas> = {
  landscape: canvasFromScale(DefaultConfig.SCALE),
  portrait: canvasFromScale(DefaultConfig.SCALE, true),
  square: canvasFromScale(DefaultConfig.SQUARE_SCALE),
};

// `Object.hasOwn`: a plain object inherits truthy `toString`/`constructor`, so `??` never falls back.
export function canvasFor(orientation: string | undefined): Canvas {
  const key = orientation ?? 'landscape';

  return Object.hasOwn(CANVASES, key) ? CANVASES[key] : CANVASES.landscape;
}
