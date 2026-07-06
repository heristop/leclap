// Pure CSS-style builder for a single background layer's preview div: a solid fill or
// a linear gradient, positioned full-bleed (base) or inset by its % geometry (extras).
import type { CSSProperties } from 'react';
import type { BackgroundLayer } from '../templateEditorModel';
import { exprToPercent } from './layerGeometry';

const GRADIENT_ANGLE: Record<'horizontal' | 'vertical' | 'diagonal', string> = {
  horizontal: 'to right',
  vertical: 'to bottom',
  diagonal: 'to bottom right',
};

// The CSS `background` value for a layer: a gradient when set, else the solid colour.
function backgroundValue(layer: BackgroundLayer): string {
  if (layer.gradient) return gradientValue(layer.gradient);

  return layer.color ?? 'transparent';
}

// Mirrors the engine's gradients `type=` lowering: linear keeps the direction sweep; radial fills
// from the centre; circular AND spiral both preview as a conic sweep — CSS cannot twist the angle
// by radius the way the spiral type does, so the angular sweep is the closest still swatch.
function gradientValue(gradient: NonNullable<BackgroundLayer['gradient']>): string {
  const { from, to, shape } = gradient;

  if (shape === 'radial') return `radial-gradient(circle at center, ${from}, ${to})`;

  if (shape === 'circular' || shape === 'spiral') return `conic-gradient(from 0deg at center, ${from}, ${to})`;

  const angle = GRADIENT_ANGLE[gradient.direction ?? 'vertical'];

  return `linear-gradient(${angle}, ${from}, ${to})`;
}

// Just the paint of a layer (fill + opacity), with no positioning — for rendering the fill inside an
// interactive box whose selection ring/handles must stay at full opacity.
export function layerFill(layer: BackgroundLayer): CSSProperties {
  return { background: backgroundValue(layer), opacity: layer.opacity ?? 1 };
}

// Absolute-position style for the preview div. The base fills the frame; an extra layer
// is inset by its % geometry so the swatch mirrors the composited drawbox.
export function cssLayerBackground(layer: BackgroundLayer, isBase: boolean): CSSProperties {
  const base: CSSProperties = { position: 'absolute', ...layerFill(layer) };

  if (isBase) return { ...base, inset: 0 };

  return {
    ...base,
    left: `${exprToPercent(layer.x, 25)}%`,
    top: `${exprToPercent(layer.y, 25)}%`,
    width: `${exprToPercent(layer.w, 50)}%`,
    height: `${exprToPercent(layer.h, 50)}%`,
  };
}
