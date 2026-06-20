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
  if (layer.gradient) {
    const angle = GRADIENT_ANGLE[layer.gradient.direction ?? 'vertical'];

    return `linear-gradient(${angle}, ${layer.gradient.from}, ${layer.gradient.to})`;
  }

  return layer.color ?? 'transparent';
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
