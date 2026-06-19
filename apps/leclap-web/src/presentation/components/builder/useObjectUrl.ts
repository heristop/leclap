import { useEffect, useRef, useState } from 'react';

// Object URL for a File, revoked when the file changes / on unmount. Shared by the preview pane and the
// filmstrip cells so a recorded clip can be shown without leaking blob URLs.
export function useObjectUrl(file: File | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const ref = useRef<string | null>(null);

  useEffect(() => {
    if (ref.current) URL.revokeObjectURL(ref.current);

    if (!file) {
      ref.current = null;
      setUrl(null);

      return () => {};
    }

    const next = URL.createObjectURL(file);
    ref.current = next;
    setUrl(next);

    return () => {
      URL.revokeObjectURL(next);
    };
  }, [file]);

  return url;
}
