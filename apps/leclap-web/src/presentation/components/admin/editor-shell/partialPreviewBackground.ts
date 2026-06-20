import { findBackground } from '@/data/mediaCatalog';

const LIBRARY_PREFIX = 'library://';

// Resolve a composed section's `options.imageUrl` marker to a previewable, same-origin URL.
// `library://<id>` maps to the curated /backgrounds asset (reusing findBackground, the same resolver
// applyMediaChoices uses); http(s) and absolute /public paths pass through. `media://<key>` uploads
// live as in-memory blobs the static preview can't fetch, so they (and empty markers) resolve to
// undefined — the caller then keeps its labelled fallback.
export const resolvePartialImageUrl = (marker: string | undefined): string | undefined => {
  if (!marker) return undefined;

  if (marker.startsWith(LIBRARY_PREFIX)) return findBackground(marker.slice(LIBRARY_PREFIX.length))?.url;

  if (marker.startsWith('http://') || marker.startsWith('https://')) return marker;

  if (marker.startsWith('/')) return marker;

  return undefined;
};
