// Pure geometry for directly manipulating an extra background layer on the preview canvas. Drag/resize
// gestures work in "percent of frame" (matching the LayerGeometryFields inputs); these helpers read a
// layer's current percentages and produce the new x/y/w/h FFmpeg expressions, clamped inside the frame.
import { percentToExpr, exprToPercent, DEFAULT_EXTRA_GEOMETRY } from './layerGeometry';
import type { BackgroundLayer } from '../templateEditorModel';

// Smallest a layer box may be dragged to, as a percentage of the frame — keeps a grabbable target.
export const MIN_LAYER_PERCENT = 5;

const clamp = (value: number, lo: number, hi: number): number => {
  const high = Math.max(lo, hi);

  return Math.min(high, Math.max(lo, value));
};

export interface LayerPercents {
  x: number;
  y: number;
  w: number;
  h: number;
}

// A layer's geometry as percentages, filling any unset axis with the extra-layer default.
export function layerPercents(layer: BackgroundLayer): LayerPercents {
  return {
    x: exprToPercent(layer.x, DEFAULT_EXTRA_GEOMETRY.x),
    y: exprToPercent(layer.y, DEFAULT_EXTRA_GEOMETRY.y),
    w: exprToPercent(layer.w, DEFAULT_EXTRA_GEOMETRY.w),
    h: exprToPercent(layer.h, DEFAULT_EXTRA_GEOMETRY.h),
  };
}

// New {x,y} expressions for a layer whose top-left is dragged to (leftPercent, topPercent), clamped so
// the box (its current w×h) stays fully inside the frame.
export function movedGeometry(leftPercent: number, topPercent: number, w: number, h: number): { x: string; y: string } {
  return {
    x: percentToExpr('x', clamp(leftPercent, 0, 100 - w)),
    y: percentToExpr('y', clamp(topPercent, 0, 100 - h)),
  };
}

// New {w,h} expressions for a layer resized from a fixed top-left (x,y percent) so its bottom-right
// sits at (rightPercent, bottomPercent), clamped to MIN_LAYER_PERCENT and the frame edge.
export function resizedGeometry(
  x: number,
  y: number,
  rightPercent: number,
  bottomPercent: number
): { w: string; h: string } {
  return {
    w: percentToExpr('w', clamp(rightPercent - x, MIN_LAYER_PERCENT, 100 - x)),
    h: percentToExpr('h', clamp(bottomPercent - y, MIN_LAYER_PERCENT, 100 - y)),
  };
}
