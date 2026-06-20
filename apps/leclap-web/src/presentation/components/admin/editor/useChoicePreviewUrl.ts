import { useEffect, useState } from 'react';
import { findBackground } from '@/data/mediaCatalog';
import { browserMediaService } from '@/services/browserMediaService';
import type { MediaChoice } from '../templateEditorModel';

// Resolve a MediaChoice to a previewable URL for the placement canvas: library → curated url, pasted
// url → as-is, upload → a transient object URL read back from IndexedDB (revoked when the choice changes).
export function useChoicePreviewUrl(choice: MediaChoice | undefined): string {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!choice) {
      setUrl('');

      return () => {};
    }

    if (choice.source === 'library') {
      setUrl(findBackground(choice.id)?.url ?? '');

      return () => {};
    }

    if (choice.source === 'url') {
      setUrl(choice.url);

      return () => {};
    }

    let objectUrl = '';
    let cancelled = false;

    browserMediaService
      .getBytes(choice.key)
      .then((bytes) => {
        if (!bytes || cancelled) return;

        objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
        setUrl(objectUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;

      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [choice]);

  return url;
}
