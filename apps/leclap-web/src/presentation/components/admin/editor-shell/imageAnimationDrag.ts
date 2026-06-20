// React-free overlay placement math for IMAGE and ANIMATION layers, extracted from
// AnimationFrameCanvas so the legacy frame canvas and the new SectionCanvas share one source of truth.
// All numbers are in output-frame px (the same space the descriptor's position/scale are measured in).
// Built on the existing pure helpers in editor/animationOverlay.ts — those are NOT re-implemented here.
import type { Orientation } from '../templateEditorModel';
import { FRAME_SIZE, clamp, parsePair, toNum } from '../editor/animationOverlay';

// Output px — smallest the overlay can be resized to. Mirrors AnimationFrameCanvas's MIN_SIZE.
export const MIN_OVERLAY_SIZE = 16;

export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Resolve the scale sides, honouring a "-1" aspect side and falling back to the natural size when a
// side is unset. Mirrors AnimationFrameCanvas's resolveScale.
function resolveScale(
  scale: string | undefined,
  nat: { w: number; h: number }
): { w: number | undefined; h: number | undefined } {
  const [rawW, rawH] = parsePair(scale);
  const w = toNum(rawW);
  const h = toNum(rawH);

  if (w === undefined && h === undefined) return { w: nat.w, h: nat.h };

  if (w !== undefined && (h === undefined || h === -1)) {
    return { w, h: Math.round((w * nat.h) / nat.w) };
  }

  if (h !== undefined && (w === undefined || w === -1)) {
    return { w: Math.round((h * nat.w) / nat.h), h };
  }

  return { w, h };
}

// Resolve the overlay's output-px rect from the stored position/scale, falling back to the media's
// natural size (and honouring a "-1" aspect side in scale). Mirrors AnimationFrameCanvas's resolveRect.
export function resolveOverlayRect(
  position: string | undefined,
  scale: string | undefined,
  natural: { w: number; h: number } | null,
  orientation: Orientation
): OverlayRect {
  const nat = natural ?? FRAME_SIZE[orientation];
  const { w, h } = resolveScale(scale, nat);
  const [rawX, rawY] = parsePair(position);

  return {
    left: toNum(rawX) ?? 0,
    top: toNum(rawY) ?? 0,
    width: Math.max(1, w ?? nat.w),
    height: Math.max(1, h ?? nat.h),
  };
}

// Drag room = the overlay's CENTER must stay within the frame. This always leaves room to move even a
// frame-filling overlay without resizing first. Mirrors AnimationFrameCanvas's xBounds/yBounds.
function moveBounds(
  width: number,
  height: number,
  orientation: Orientation
): { x: [number, number]; y: [number, number] } {
  const frame = FRAME_SIZE[orientation];

  return {
    x: [-width / 2, frame.w - width / 2],
    y: [-height / 2, frame.h - height / 2],
  };
}

export interface MoveArgs {
  baseX: number;
  baseY: number;
  deltaX: number;
  deltaY: number;
  width: number;
  height: number;
  orientation: Orientation;
}

// Move patch: shift the box origin by the (frame-px) pointer delta, clamped so its centre stays in frame.
export function moveOverlay(args: MoveArgs): { position: string } {
  const bounds = moveBounds(args.width, args.height, args.orientation);
  const x = clamp(Math.round(args.baseX + args.deltaX), bounds.x[0], bounds.x[1]);
  const y = clamp(Math.round(args.baseY + args.deltaY), bounds.y[0], bounds.y[1]);

  return { position: `${x}:${y}` };
}

export interface ResizeArgs {
  baseW: number;
  baseH: number;
  deltaX: number;
  deltaY: number;
  orientation: Orientation;
}

// Resize patch: grow/shrink the box by the (frame-px) pointer delta, clamped to a sane min/max.
export function resizeOverlay(args: ResizeArgs): { scale: string } {
  const frame = FRAME_SIZE[args.orientation];
  const w = clamp(Math.round(args.baseW + args.deltaX), MIN_OVERLAY_SIZE, frame.w * 2);
  const h = clamp(Math.round(args.baseH + args.deltaY), MIN_OVERLAY_SIZE, frame.h * 2);

  return { scale: `${w}:${h}` };
}

export interface NudgeArgs {
  position: string | undefined;
  scale: string | undefined;
  natural: { w: number; h: number } | null;
  orientation: Orientation;
  dx: number;
  dy: number;
}

// Nudge patch: shift the position by a step (output px), clamped to the same centre-in-frame bounds.
export function nudgeOverlay(args: NudgeArgs): { position: string } {
  const rect = resolveOverlayRect(args.position, args.scale, args.natural, args.orientation);
  const bounds = moveBounds(rect.width, rect.height, args.orientation);
  const x = clamp(rect.left + args.dx, bounds.x[0], bounds.x[1]);
  const y = clamp(rect.top + args.dy, bounds.y[0], bounds.y[1]);

  return { position: `${x}:${y}` };
}

// Centre a box of (width × height) output-px on a frame fraction, returning the descriptor "x:y"
// origin (top-left) clamped so the centre stays in frame. Used when dropping a library item or moving
// an element to a cursor point — the cursor lands on the box centre, not its corner.
export function positionFromFraction(
  fracX: number,
  fracY: number,
  width: number,
  height: number,
  orientation: Orientation
): string {
  const frame = FRAME_SIZE[orientation];
  const cursorX = clamp(fracX, 0, 1) * frame.w;
  const cursorY = clamp(fracY, 0, 1) * frame.h;
  const bounds = moveBounds(width, height, orientation);
  const x = clamp(Math.round(cursorX - width / 2), bounds.x[0], bounds.x[1]);
  const y = clamp(Math.round(cursorY - height / 2), bounds.y[0], bounds.y[1]);

  return `${x}:${y}`;
}

export interface RotateArgs {
  centerX: number;
  centerY: number;
  clientX: number;
  clientY: number;
  snap: boolean;
}

// Rotate patch: degrees clockwise (0 = up) from the box centre to the pointer, snapped to 15° on demand.
// Mirrors AnimationFrameCanvas's angleToPointer.
export function rotateOverlay(args: RotateArgs): { rotation: number } {
  const deg = (Math.atan2(args.clientY - args.centerY, args.clientX - args.centerX) * 180) / Math.PI + 90;
  const wrapped = ((Math.round(deg) + 180) % 360) - 180;

  return { rotation: args.snap ? Math.round(wrapped / 15) * 15 : wrapped };
}
