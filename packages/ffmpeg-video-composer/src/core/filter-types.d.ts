// Filtergraph primitive types — the input / filter / map building blocks plus the editor-only shape
// recipe — live here to keep `types.d.ts` under the max-lines budget; the public ones are re-exported
// from `./types` so `@/core/types` stays the single entry point.
import type { Reveal, Exit } from './descriptor-text';

/** How an overlay maps into its "w:h" scale box: free stretch, letterbox inside, or fill + centre-crop. */
export type OverlayFit = 'stretch' | 'contain' | 'cover';

/** Mirror applied to the overlay leg before rotation: left-right, top-bottom, or both. */
export type OverlayFlip = 'horizontal' | 'vertical' | 'both';

// Shared localisation map (locale key → string). A leaf dependency of FilterValues below and of the
// section/overlay/field declarations in `./types`, which imports it back.
export interface Translation {
  [key: string]: string | undefined;
}

/**
 * Editor-only recipe of a builder-rasterized shape overlay (the input's url carries the actual PNG).
 * The engine never reads it; it exists so the builder re-hydrates shape controls on import.
 */
export interface ShapeSpec {
  kind: 'rect' | 'ellipse';
  /** Fill colour as a hex string (e.g. "#ff4d4d"). */
  color: string;
  /** Rounded-corner radius in output pixels; rectangles only (0/omitted = square corners). */
  cornerRadius?: number;
  /** Outline width in output pixels drawn inside the shape bounds (0/omitted = no outline). */
  strokeWidth?: number;
  /** Outline colour as a hex string; used when strokeWidth > 0. */
  strokeColor?: string;
}

export interface Input {
  name: string;
  url?: string;
  type?: 'animation' | 'image';
  /** Editor-only shape recipe when this image input is a builder-rasterized shape; ignored by the engine. */
  shape?: ShapeSpec;
  options?: InputOptions;
  filters?: Filter[];
}

interface InputOptions {
  fps?: number;
  position?: string;
  scale?: string;
  /** Aspect handling within the "w:h" scale box; 'stretch' (or omitted) scales freely. */
  fit?: OverlayFit;
  persistent?: boolean;
  loop?: boolean;
  /** Finite play count; takes precedence over loop. */
  loops?: number;
  /** Seconds the overlay plays before it ends; takes precedence over loops/loop. */
  duration?: number;
  /** Seconds to delay the overlay before it appears (via -itsoffset); 0/omitted starts at the beginning. */
  start?: number;
  /** Overlay alpha, 0–1. 1 (or omitted) keeps the animation fully opaque. */
  opacity?: number;
  /** Clockwise rotation in degrees applied to the overlay before compositing. 0 (or omitted) = upright. */
  rotation?: number;
  /** Mirror the overlay before compositing: left-right, top-bottom, or both. */
  flip?: OverlayFlip;
  /** Animated entrance for the overlay (rise/slide/fade), reusing the reveal vocabulary. */
  motion?: Reveal;
}

export interface Map {
  inputs: string[];
  outputs: string[];
  filters?: Filter[];
  options?: MapOptions;
}

type MapOptions = {
  useSectionFilters?: boolean;
};

export interface Filter {
  type: string;
  value?: string | number;
  values?: FilterValues;
  range?: string;
  // Animated entrance for a `drawtext` filter: the engine bakes it into alpha + kinetic x/y
  // expressions (from the filter's base x/y) at compile, the same reveal vocabulary the text sugar uses.
  reveal?: Reveal;
  // Animated exit (fade/slide out after a time) baked alongside the entrance onto the same drawtext.
  exit?: Exit;
}

export interface FilterValues {
  h?: number | string;
  w?: number | string;
  x?: number | string;
  y?: number | string;
  c?: string;
  t?: string | number;
  text?: Translation;
  fontcolor?: string;
  fontsize?: number | string;
  fontfile?: string;
  alpha?: string;
  d?: string;
  st?: string;
  color?: string;
  box?: number | string;
  boxcolor?: string;
  boxborderw?: number | string;
  // drawtext drop-shadow / outline keys — mirrored from filter.schemas.ts (shadow*/border* are
  // colour-formatted via FormatterManager.COLOR_KEYS at compile).
  shadowcolor?: string;
  shadowx?: number | string;
  shadowy?: number | string;
  bordercolor?: string;
  borderw?: number | string;
  // Timeline gate expression forwarded to the filter's `enable=` option, pre-quoted when it holds
  // commas (e.g. `'gte(t,0.3)'`) — mirrored from filter.schemas.ts.
  enable?: string;
}

type MapAnimationOptions = {
  fps: number;
  position: string;
  scale: string;
  /** Aspect handling within the "w:h" scale box; 'stretch' (or omitted) scales freely. */
  fit?: OverlayFit;
  persistent: boolean;
  loop: boolean;
  loops?: number;
  duration?: number;
  start?: number;
  opacity?: number;
  motion?: Reveal;
};

export type MapAnimationInput = {
  url: string;
  name: string;
  type: string;
  extension: string;
  options: MapAnimationOptions;
  // Optional in the schema (InputSchema.filters) — builder-authored inputs omit it.
  filters?: Filter[];
};
