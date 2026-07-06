// Pure CSS-style builder for a single background layer's preview div: a solid fill, a gradient, or
// an outline stroke (border), positioned full-bleed (base) or inset by its % geometry (extras).
// Layer colours may hold '{{ variable }}' tokens — they resolve against the optional `vars`
// scope the way the engine's formatColor does at compile time.
import type { CSSProperties } from 'react';
import { resolvePreviewColor, type ColorVariableMap } from '@leclap/creative-kit/editor';
import type { BackgroundLayer } from '../templateEditorModel';
import { exprToPercent } from './layerGeometry';

const GRADIENT_ANGLE: Record<'horizontal' | 'vertical' | 'diagonal', string> = {
  horizontal: 'to right',
  vertical: 'to bottom',
  diagonal: 'to bottom right',
};

// The CSS `background` value for a layer: a gradient when set, else the solid colour.
function backgroundValue(layer: BackgroundLayer, vars?: ColorVariableMap): string {
  if (layer.gradient) return gradientValue(layer.gradient, vars);

  if (layer.color === undefined) return 'transparent';

  return resolvePreviewColor(layer.color, vars);
}

// Mirrors the engine's gradients `type=` lowering: linear keeps the direction sweep; radial fills
// from the centre; circular AND spiral both preview as a conic sweep — CSS cannot twist the angle
// by radius the way the spiral type does, so the angular sweep is the closest still swatch.
// A free `angle` uses the CSS degree convention on both sides, so it passes straight through and,
// like the engine, wins over the direction enum (and is ignored by non-linear shapes).
function gradientValue(gradient: NonNullable<BackgroundLayer['gradient']>, vars?: ColorVariableMap): string {
  const from = resolvePreviewColor(gradient.from, vars);
  const to = resolvePreviewColor(gradient.to, vars);
  const { shape } = gradient;

  if (shape === 'radial') return `radial-gradient(circle at center, ${from}, ${to})`;

  if (shape === 'circular' || shape === 'spiral') return `conic-gradient(from 0deg at center, ${from}, ${to})`;

  if (gradient.angle !== undefined) return `linear-gradient(${gradient.angle}deg, ${from}, ${to})`;

  const angle = GRADIENT_ANGLE[gradient.direction ?? 'vertical'];

  return `linear-gradient(${angle}, ${from}, ${to})`;
}

// Mirrors the engine's border lowering (looks.ts layersToFilters): a drawbox with numeric thickness
// t draws the stroke inward along the box edge — an inset box-shadow is the CSS equivalent. The
// width is authored in ENGINE output px; `borderScale` (preview px per engine px) rescales it to the
// frame, clamped to a 1px hairline so thin strokes survive small monitors and the unmeasured first paint.
function borderShadow(layer: BackgroundLayer, vars: ColorVariableMap | undefined, borderScale: number): CSSProperties {
  const border = layer.border;

  if (!border || layer.gradient) return {};

  const widthPx = Math.max(1, Math.round(border.width * borderScale));

  return { boxShadow: `inset 0 0 0 ${widthPx}px ${resolvePreviewColor(border.color, vars)}` };
}

// Just the paint of a layer (fill + opacity + border stroke), with no positioning — for rendering the
// fill inside an interactive box whose selection ring/handles must stay at full opacity.
export function layerFill(layer: BackgroundLayer, vars?: ColorVariableMap, borderScale = 1): CSSProperties {
  return {
    background: backgroundValue(layer, vars),
    opacity: layer.opacity ?? 1,
    ...borderShadow(layer, vars, borderScale),
  };
}

// Absolute-position style for the preview div. The base fills the frame; an extra layer
// is inset by its % geometry so the swatch mirrors the composited drawbox.
export function cssLayerBackground(
  layer: BackgroundLayer,
  isBase: boolean,
  vars?: ColorVariableMap,
  borderScale = 1
): CSSProperties {
  const base: CSSProperties = { position: 'absolute', ...layerFill(layer, vars, borderScale) };

  if (isBase) return { ...base, inset: 0 };

  return {
    ...base,
    left: `${exprToPercent(layer.x, 25)}%`,
    top: `${exprToPercent(layer.y, 25)}%`,
    width: `${exprToPercent(layer.w, 50)}%`,
    height: `${exprToPercent(layer.h, 50)}%`,
  };
}
