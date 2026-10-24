// The theme switch's "slate stripes" wipe: the new theme comes in through diagonal stripes that lean like
// the clapperboard's stick stripes (the logo's 26° pattern). They open in a wave from the toggle, the
// nearest first, and widen until they merge. Pure geometry: the frames are clip-path path() strings for the
// new view-transition snapshot, all with the same commands so the browser can interpolate between them.

interface Viewport {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

export interface SlateBand {
  /** Position of the stripe's centre line across the stripes, in px. */
  center: number;
  /** When it starts opening, as a fraction of the whole wipe (0 for the stripe under the toggle). */
  delay: number;
}

// The stripes lean like "/" — 26° off vertical, the logo's stripe angle. NORMAL runs across them, ALONG
// them; both are unit vectors, so (u, v) is just a rotated pixel frame.
const TILT = (26 * Math.PI) / 180;
const NORMAL = { x: Math.cos(TILT), y: Math.sin(TILT) };
const ALONG = { x: Math.sin(TILT), y: -Math.cos(TILT) };

// How much of the wipe the wave takes to reach the farthest stripe; each stripe opens over the rest.
const STAGGER = 0.45;
const OPEN = 1 - STAGGER;

const across = (p: Point) => p.x * NORMAL.x + p.y * NORMAL.y;
const along = (p: Point) => p.x * ALONG.x + p.y * ALONG.y;

const corners = ({ width, height }: Viewport): Point[] => [
  { x: 0, y: 0 },
  { x: width, y: 0 },
  { x: 0, y: height },
  { x: width, y: height },
];

const span = (values: number[]) => ({ min: Math.min(...values), max: Math.max(...values) });

/** The stripes across the viewport, evenly spaced, each with its opening delay. */
export const slateBands = (viewport: Viewport, origin: Point): { bands: SlateBand[]; spacing: number } => {
  const u = span(corners(viewport).map(across));
  const reach = u.max - u.min;
  const count = Math.max(8, Math.round(reach / 72));
  const spacing = reach / count;
  const start = across(origin);
  const centers = Array.from({ length: count }, (_, k) => u.min + spacing * (k + 0.5));
  const nearest = Math.min(...centers.map((c) => Math.abs(c - start)));
  const farthest = Math.max(...centers.map((c) => Math.abs(c - start)));
  const range = farthest - nearest || 1;

  return {
    spacing,
    bands: centers.map((center) => ({ center, delay: ((Math.abs(center - start) - nearest) / range) * STAGGER })),
  };
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const fixed = (n: number) => n.toFixed(2);

const toScreen = (u: number, v: number) => `${fixed(u * NORMAL.x + v * ALONG.x)} ${fixed(u * NORMAL.y + v * ALONG.y)}`;

/** `steps` clip-path frames from closed (no stripe open) to every stripe overlapping its neighbours. */
export const slateWipeFrames = (viewport: Viewport, origin: Point, steps = 40): string[] => {
  const { bands, spacing } = slateBands(viewport, origin);
  const v = span(corners(viewport).map(along));
  const full = spacing / 2 + 1;

  return Array.from({ length: steps }, (_, step) => {
    const progress = step / (steps - 1);
    const shapes = bands.map(({ center, delay }) => {
      const local = Math.min(1, Math.max(0, (progress - delay) / OPEN));
      const half = full * easeOutCubic(local);

      return `M${toScreen(center - half, v.min)} L${toScreen(center + half, v.min)} L${toScreen(center + half, v.max)} L${toScreen(center - half, v.max)} Z`;
    });

    return `path('${shapes.join(' ')}')`;
  });
};
