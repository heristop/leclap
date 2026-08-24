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
export function describeAccept(spec: AcceptSpec): string {
  const seen = new Set<string>();

  for (const group of spec) {
    for (const extension of group.extensions) {
      seen.add(extension.replace(/^\./, '').toUpperCase());
    }
  }

  return [...seen].join(', ');
}
