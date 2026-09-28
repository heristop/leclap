// Reads the motion tokens the /design page documents. The page draws each easing curve and lists each
// duration from the live CSS custom properties (index.css), not from a copy of their values, so the
// specimen can never show a curve the app has stopped using. Pure string work — unit-tested in node.

export type Bezier = readonly [number, number, number, number];

const CUBIC_BEZIER = /^cubic-bezier\(([^)]*)\)$/;

export function parseCubicBezier(value: string): Bezier | null {
  const match = CUBIC_BEZIER.exec(value.trim());

  if (!match) return null;

  const points = match[1].split(',').map((part) => Number(part.trim()));

  if (points.length !== 4 || points.some((point) => !Number.isFinite(point))) return null;

  return [points[0], points[1], points[2], points[3]];
}

// Two decimals is finer than a pixel at any size the page draws.
const round = (value: number): number => Math.round(value * 100) / 100;

// The curve as an SVG path in a `size` box with y pointing up (progress 0 at the bottom, 1 at the top).
// A springy control point may sit outside the box: that overshoot is the point of showing it.
export function bezierPath([x1, y1, x2, y2]: Bezier, size: number): string {
  const at = (x: number, y: number): string => `${round(x * size)} ${round(size - y * size)}`;

  return `M0 ${size} C${at(x1, y1)} ${at(x2, y2)} ${size} 0`;
}

// A CSS time (`0.28s`, `200ms`) in milliseconds.
export function durationMs(value: string): number | null {
  const match = /^([\d.]+)(ms|s)$/.exec(value.trim());

  if (!match) return null;

  const amount = Number(match[1]);

  if (!Number.isFinite(amount)) return null;

  return Math.round(match[2] === 's' ? amount * 1000 : amount);
}
