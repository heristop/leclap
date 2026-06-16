import { useEffect, useState } from 'react';
import { loadOutput } from '@/services/projectService';
import { captureVideoPoster } from '@/lib/videoPoster';
import { logger } from '@/lib/logger';
import type { StoredProject } from '@/lib/projectModel';

// One capture per output blob, shared across cards and remounts — re-opening Projects never re-decodes
// a video it has already postered.
const posterCache = new Map<string, string>();

/**
 * A JPEG data-URL poster grabbed from a completed project's rendered video (via {@link captureVideoPoster}),
 * or null for drafts, while decoding, or on failure. Cached by output blob key so the cost is paid once.
 */
export function useProjectPoster(project: StoredProject): string | null {
  const blobKey = project.status === 'completed' ? project.output?.blobKey : undefined;
  const [poster, setPoster] = useState<string | null>(() => (blobKey ? (posterCache.get(blobKey) ?? null) : null));

  useEffect(() => {
    if (!blobKey) {
      setPoster(null);

      return;
    }

    const cached = posterCache.get(blobKey);

    if (cached) {
      setPoster(cached);

      return;
    }

    let cancelled = false;

    loadOutput(project)
      .then(async (output) => {
        if (!output || cancelled) return;

        const dataUrl = await captureVideoPoster(output.blob);

        if (!dataUrl || cancelled) return;

        posterCache.set(blobKey, dataUrl);
        setPoster(dataUrl);
      })
      .catch((error: unknown) => {
        logger.error('Project poster capture failed:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [blobKey, project]);

  return poster;
}
