import type { AcceptSpec } from './types';

/**
 * The accepted extensions as a display list ('MP3, WAV, M4A').
 *
 * The hint shown under an upload pane used to be a hand-written translation string, which drifted
 * from the accept spec it was describing — `.aac`, `.ogg` and `.m4v` were all accepted and none of
 * them advertised. Deriving the list from the spec makes that class of drift impossible.
 *
 * Only the extensions are described, never the `mime`: the wildcard groups (`video/*`) are
 * deliberately broad so mobile pickers keep their Camera / Photo Library entries, and advertising
 * "video/*" to a human says nothing.
 */
// How an extension is written when it is shown to a person, wherever that differs from shouting it.
// Two jobs, and both are corrections to a blanket `.toUpperCase()`:
//   • collapse the spellings of one format onto one entry — `.jpg` and `.jpeg` are the same format,
//     and "JPG, JPEG" reads as two;
//   • keep the casing the formats themselves use — WebP and WebM are brand spellings, and `WEBP` is
//     wrong the way `Pdf` would be. This string is interpolated into copy in five languages, so no
//     translator can correct it downstream.
// Anything absent falls back to the bare extension uppercased, which is right for MP3, PNG, MOV…
const DISPLAY_NAME: Record<string, string> = {
  jpeg: 'JPG',
  webm: 'WebM',
  webp: 'WebP',
};

export function describeAccept(spec: AcceptSpec): string {
  // A Set of display names, so de-duplication happens by format rather than by extension, and the
  // authored order still survives.
  const seen = new Set<string>();

  for (const group of spec) {
    for (const extension of group.extensions) {
      const bare = extension.replace(/^\./, '').toLowerCase();

      seen.add(DISPLAY_NAME[bare] ?? bare.toUpperCase());
    }
  }

  return [...seen].join(', ');
}
