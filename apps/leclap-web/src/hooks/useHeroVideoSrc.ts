import { useEffect, useState } from 'react';
import { HERO_VIDEO_UPDATED_EVENT, getHeroVideoUrl } from '@/services/heroVideoStore';

const DEFAULT_HERO_SRC = '/videos/clapperboard.mp4';

// The Home hero background src: the visitor's onboarding-compiled video for this session when present,
// otherwise the bundled default. Swaps live when a fresh video is set (right after onboarding compiles).
// The store owns the object URL's lifecycle, so this only reads it.
export function useHeroVideoSrc(): string {
  const [src, setSrc] = useState(() => getHeroVideoUrl() ?? DEFAULT_HERO_SRC);

  useEffect(() => {
    const refresh = () => {
      setSrc(getHeroVideoUrl() ?? DEFAULT_HERO_SRC);
    };

    refresh();
    window.addEventListener(HERO_VIDEO_UPDATED_EVENT, refresh);

    return () => {
      window.removeEventListener(HERO_VIDEO_UPDATED_EVENT, refresh);
    };
  }, []);

  return src;
}
