// Filled drawboxes — bands, pills, accent bars, authored cards — and what they do to the text drawn
// with them: a panel drawn before a piece of text is its backdrop, one drawn after paints over it.
import { parseColor } from '@/core/color-contrast';
import type { DrawLayer } from './draw-layers';
import { evaluateExpr } from './drawtext-expr';
import type { Box, Canvas, Panel } from './geometry-types';
import { track } from './layer-track';
import { boxPaints, paintOver } from './text-appearance';

export interface PanelPlacement {
  entry: { duration: number; startSec: number; sectionIndex: number };
  canvas: Canvas;
}

export function panelFor(layer: DrawLayer, drawIndex: number, placement: PanelPlacement): Panel | null {
  const { entry, canvas } = placement;
  const values = layer.values;
  const color = values.c ?? values.color;

  // Only a filled drawbox paints an area; `t=<n>` is an outline n pixels thick.
  if (values.t !== 'fill' || typeof color !== 'string') {
    return null;
  }

  const frame = { w: canvas.width, h: canvas.height };
  const position = track(values, frame, entry.duration);
  const width = evaluateExpr(values.w, frame);
  const height = evaluateExpr(values.h, frame);

  if (!position || width === null || height === null) {
    return null;
  }

  return {
    label: layer.label,
    x: position.x,
    y: position.y,
    width,
    height,
    color,
    startSec: entry.startSec + position.from,
    endSec: entry.startSec + position.to,
    sectionIndex: entry.sectionIndex,
    drawIndex,
  };
}

function contains(panel: Panel, x: number, y: number): boolean {
  return x >= panel.x && x <= panel.x + panel.width && y >= panel.y && y <= panel.y + panel.height;
}

// A panel this opaque separates text from whatever is under it (the lowerThird band is 0.6); a lighter
// tint over footage does not.
const PANEL_AID_OPACITY = 0.5;

// The section background, then every panel drawn EARLIER and on screen with the text that covers its
// centre, then the text's own box. Text sitting on a panel (a lowerThird's band) has a legibility aid
// even when what lies under the panel is unknown. Panels drawn later paint over the text — see
// coveredTextWarnings.
export function appearanceOver(
  box: Box,
  values: Record<string, unknown>,
  panels: Panel[],
  base: string | null
): Pick<Box, 'backdrop' | 'legibilityAid'> {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const beneath = panels.filter(
    (panel) => panel.startSec <= box.startSec && panel.endSec >= box.startSec && contains(panel, cx, cy)
  );
  const under = beneath.reduce<string | null>((backdrop, panel) => paintOver(panel.color, backdrop), base);

  return {
    backdrop: boxPaints(values) ? paintOver(values.boxcolor ?? 'white', under) : under,
    legibilityAid:
      box.legibilityAid || beneath.some((panel) => (parseColor(panel.color)?.alpha ?? 1) >= PANEL_AID_OPACITY),
  };
}
