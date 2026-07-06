// Shape elements over the existing image-overlay pipeline: the builder rasterizes a rect/ellipse
// recipe (ShapeSpec) into a PNG data: URL client-side and stores it as a normal ImageOverlay, so
// placement, preview and playback all reuse the image path with ZERO engine work. The recipe rides
// the overlay (`shape`) and is re-rasterized here whenever a shape parameter changes.
// Pure geometry (`shapeDrawPlan`, box helpers) is separated from the thin canvas executor so the
// planning logic is unit-testable in node.
import { makeTemplateId, type ImageOverlay, type Orientation, type ShapeSpec } from '../templateEditorModel';
import { ENGINE_FRAME } from './sugarPreviewGeometry';

// Rasterization oversampling: the PNG is drawn at 2x the target box so downscaled composites and
// zoomed previews stay crisp.
export const SHAPE_RASTER_SCALE = 2;

// Emergency placeholder (a 1x1 transparent PNG) when no 2D canvas exists (node tests, exotic
// browsers) — keeps the overlay's choice a valid image url instead of an empty string.
const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Default fill for a fresh shape — the same brand violet a fresh color section uses.
const DEFAULT_SHAPE_COLOR = '#7C83FD';

export function defaultShapeSpec(kind: ShapeSpec['kind']): ShapeSpec {
  return { kind, color: DEFAULT_SHAPE_COLOR };
}

// The target box (output px) for a fresh shape: a square sized from a third of the frame's short
// edge, so it reads at a similar scale in every orientation.
export function defaultShapeBox(orientation: Orientation): { w: number; h: number } {
  const frame = ENGINE_FRAME[orientation];
  const edge = Math.round(Math.min(frame.w, frame.h) / 3);

  return { w: edge, h: edge };
}

// The overlay's "w:h" scale box as raster target px, falling back to the orientation default when
// the scale is absent or not a plain positive pixel pair (expressions like "iw/2:ih" can't size a
// raster).
export function shapeTargetBox(scale: string | undefined, orientation: Orientation): { w: number; h: number } {
  const match = /^(\d+):(\d+)$/.exec(scale ?? '');

  if (!match) return defaultShapeBox(orientation);

  const w = Number(match[1]);
  const h = Number(match[2]);

  if (w <= 0 || h <= 0) return defaultShapeBox(orientation);

  return { w, h };
}

// A declarative canvas draw: everything the executor needs, precomputed. Canvas strokes straddle the
// path, so the path is inset by half the stroke width to keep the outline fully inside the box.
export interface ShapeDrawPlan {
  width: number;
  height: number;
  fill: string;
  path:
    | { type: 'rect'; x: number; y: number; w: number; h: number; radius: number }
    | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number };
  stroke?: { color: string; width: number };
}

export function shapeDrawPlan(
  shape: ShapeSpec,
  box: { w: number; h: number },
  scale: number = SHAPE_RASTER_SCALE
): ShapeDrawPlan {
  const width = box.w * scale;
  const height = box.h * scale;
  const strokeWidth = (shape.strokeWidth ?? 0) * scale;
  const inset = strokeWidth / 2;
  const stroke = strokeWidth > 0 ? { color: shape.strokeColor ?? '#ffffff', width: strokeWidth } : undefined;

  if (shape.kind === 'ellipse') {
    return {
      width,
      height,
      fill: shape.color,
      path: { type: 'ellipse', cx: width / 2, cy: height / 2, rx: width / 2 - inset, ry: height / 2 - inset },
      ...(stroke ? { stroke } : {}),
    };
  }

  const w = width - strokeWidth;
  const h = height - strokeWidth;
  const radius = Math.min((shape.cornerRadius ?? 0) * scale, Math.min(w, h) / 2);

  return {
    width,
    height,
    fill: shape.color,
    path: { type: 'rect', x: inset, y: inset, w, h, radius },
    ...(stroke ? { stroke } : {}),
  };
}

// Trace the plan's path onto the context (shared by fill and stroke).
function tracePath(ctx: CanvasRenderingContext2D, path: ShapeDrawPlan['path']): void {
  ctx.beginPath();

  if (path.type === 'ellipse') {
    ctx.ellipse(path.cx, path.cy, path.rx, path.ry, 0, 0, Math.PI * 2);

    return;
  }

  if (path.radius > 0) {
    ctx.roundRect(path.x, path.y, path.w, path.h, path.radius);

    return;
  }

  ctx.rect(path.x, path.y, path.w, path.h);
}

// Rasterize the shape recipe to a PNG data: URL at 2x the target box. Falls back to a transparent
// placeholder when no 2D canvas is available (never in a real browser).
export function renderShapePng(shape: ShapeSpec, box: { w: number; h: number }): string {
  if (typeof document === 'undefined') return TRANSPARENT_PNG;

  const plan = shapeDrawPlan(shape, box);
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return TRANSPARENT_PNG;

  tracePath(ctx, plan.path);
  ctx.fillStyle = plan.fill;
  ctx.fill();

  if (plan.stroke) {
    ctx.lineWidth = plan.stroke.width;
    ctx.strokeStyle = plan.stroke.color;
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}

// A fresh shape element: a default-recipe PNG centred in the frame at the orientation's default box.
export function newShapeImage(kind: ShapeSpec['kind'], orientation: Orientation): ImageOverlay {
  const shape = defaultShapeSpec(kind);
  const box = defaultShapeBox(orientation);
  const frame = ENGINE_FRAME[orientation];

  return {
    id: makeTemplateId(),
    choice: { source: 'url', url: renderShapePng(shape, box) },
    position: `${Math.round((frame.w - box.w) / 2)}:${Math.round((frame.h - box.h) / 2)}`,
    scale: `${box.w}:${box.h}`,
    shape,
  };
}

// The overlay patch for a recipe change: the new recipe plus its PNG re-rasterized at the overlay's
// CURRENT scale box, so corner radii and strokes keep their authored pixel size after a resize.
export function regeneratedShapePatch(
  overlay: ImageOverlay,
  shape: ShapeSpec,
  orientation: Orientation
): Partial<ImageOverlay> {
  return { shape, choice: { source: 'url', url: renderShapePng(shape, shapeTargetBox(overlay.scale, orientation)) } };
}
