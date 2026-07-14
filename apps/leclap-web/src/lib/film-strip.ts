import type { CSSProperties } from 'react';

// Sprocket-hole perforation row (one tile = 28px) in brand lavender on transparent. Tiled along an
// edge with `animate-film-drift`, it reads as a frame of film running through a projector — the
// motif introduced in the footer and reused on the home showcase frames. The drift translates the
// tile span (compositor-only, no per-frame repaint), so the row splits in two: the moving span
// carries the tile background, while a static wrapper carries the edge-fade mask that keeps the
// holes from hard-cutting at the ends (on the drifting span the fade would slide along with it).
const PERFORATION_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='14'%3E%3Crect x='9' y='4' width='10' height='6' rx='2' fill='%237c83fd' fill-opacity='0.34'/%3E%3C/svg%3E\")";

export const perforationTileStyle: CSSProperties = {
  backgroundImage: PERFORATION_URL,
  backgroundRepeat: 'repeat-x',
  backgroundSize: '28px 14px',
};

export const perforationMaskStyle: CSSProperties = {
  WebkitMaskImage: 'linear-gradient(to right, transparent, #000 9%, #000 91%, transparent)',
  maskImage: 'linear-gradient(to right, transparent, #000 9%, #000 91%, transparent)',
};
