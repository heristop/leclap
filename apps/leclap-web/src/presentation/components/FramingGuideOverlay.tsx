import { useEffect, useRef, useState, type RefObject } from 'react';
import type { FramingGuideConfig } from 'ffmpeg-video-composer/src/core/types.d.ts';
import { DEFAULT_FRAMING_OPACITY } from '@/presentation/components/admin/templateEditorModel';

interface FramingGuideOverlayProps {
  guide: FramingGuideConfig;
}

// Horizontal dock for the silhouette — a comfortable inset off each edge so left / center / right
// read as three distinct spots. Shared with the admin picker's mockup so the editor preview and the
// live overlay agree on exactly where the silhouette sits.
//
// Position is in screen space — 'left' means the left edge of the live preview. The live <video>
// applies -scale-x-100 when facing mode is 'user' (front camera), which mirrors the preview; because
// we overlay on the same element the silhouette mirrors too, keeping 'left' on the user's left.
// Horizontal placement of the bust. A wide 16:9 frame can afford a generous edge inset; a narrow
// 9:16 frame needs tighter insets, otherwise a bust wide enough to be useful would span almost the
// whole width and left/center/right would all look the same.
export const SILHOUETTE_POSITION_CLASS: Record<FramingGuideConfig['position'], string> = {
  left: 'left-[15%]',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-[15%]',
};

const SILHOUETTE_POSITION_CLASS_PORTRAIT: Record<FramingGuideConfig['position'], string> = {
  left: 'left-[4%]',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-[4%]',
};

// The dock, tuned per frame shape so the live overlay and the admin mockup stay pixel-identical:
// a tall 9:16 frame sizes the bust by WIDTH (so it leaves room to shift left/center/right); a wide
// 16:9 frame sizes by height. Returned as the full dock class.
export const silhouetteDockClass = (isPortrait: boolean, position: FramingGuideConfig['position']): string => {
  if (isPortrait) {
    return `absolute aspect-[120/124] w-[64%] bottom-[10%] ${SILHOUETTE_POSITION_CLASS_PORTRAIT[position]}`;
  }

  return `absolute aspect-[120/124] h-[66%] bottom-[12%] ${SILHOUETTE_POSITION_CLASS[position]}`;
};

// A light framing contour, NOT a solid avatar: a thin crisp white line you position yourself inside,
// with the camera feed showing through. Drawn in layers — a soft dark edge for legibility on bright
// feeds, an optional whisper of fill ('bust'), then the white contour. 'outline' is the contour alone.
// ONE continuous head-and-shoulders contour as a single path — no internal crossing lines and no
// stalk "neck": the head arc flows straight into broad, SHORT shoulders that sweep out to a wide
// rounded chest and run off the bottom of the frame (no closing base line on screen).
const SILHOUETTE = 'M42 60 A28 28 0 1 1 78 60 C92 66 116 94 118 130 L2 130 C2 94 28 66 42 60 Z';

export const SilhouetteSvg = ({ opacity, style }: { opacity: number; style: 'bust' | 'outline' }) => (
  <svg viewBox="0 0 120 124" className="h-full w-full" style={{ opacity }} aria-hidden="true" focusable="false">
    {/* Soft dark edge so the white line stays legible over light/busy feeds. */}
    <path d={SILHOUETTE} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="5" strokeLinejoin="round" />
    {/* 'bust' adds a faint frosted fill to suggest the zone; 'outline' leaves the feed fully visible. */}
    {style === 'bust' && <path d={SILHOUETTE} fill="rgba(255,255,255,0.12)" />}
    {/* The contour itself: a clean, thin white line. */}
    <path d={SILHOUETTE} fill="none" stroke="white" strokeWidth="2.25" strokeLinejoin="round" />
  </svg>
);

// Track whether an element is taller than it is wide, so the silhouette can size itself to the
// actual viewfinder shape rather than a single hard-coded fraction.
const useIsPortrait = (ref: RefObject<HTMLElement | null>): boolean => {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const update = () => {
      if (el) {
        setIsPortrait(el.clientHeight > el.clientWidth);
      }
    };
    const observer = new ResizeObserver(update);

    if (el) {
      update();
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return isPortrait;
};

export const FramingGuideOverlay = ({ guide }: FramingGuideOverlayProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isPortrait = useIsPortrait(ref);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      <div className={silhouetteDockClass(isPortrait, guide.position)}>
        <SilhouetteSvg opacity={guide.opacity ?? DEFAULT_FRAMING_OPACITY} style={guide.style ?? 'bust'} />
      </div>
    </div>
  );
};
