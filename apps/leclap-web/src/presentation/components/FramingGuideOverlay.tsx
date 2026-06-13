import type { FramingGuideConfig } from 'ffmpeg-video-composer/src/core/types.d.ts';

interface FramingGuideOverlayProps {
  guide: FramingGuideConfig;
}

// Horizontal alignment of the silhouette within the frame.
// Position is in screen space — 'left' means the left edge of the live preview.
// The live <video> element applies -scale-x-100 when facing mode is 'user' (front camera),
// which mirrors the preview. Because we overlay on top of that same element, the silhouette
// is visually mirrored too, keeping 'left' on the user's left as they see it on screen.
const JUSTIFY: Record<FramingGuideConfig['position'], string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

// A simple bust silhouette: head (ellipse) + smooth shoulder/torso path.
// ViewBox 120×200; rendered at 70 % of the container height via the parent element.
const SilhouetteSvg = ({ opacity }: { opacity: number }) => (
  <svg viewBox="0 0 120 200" className="w-full h-full" style={{ opacity }} aria-hidden="true" focusable="false">
    {/* Head */}
    <ellipse cx="60" cy="44" rx="28" ry="32" fill="white" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
    {/* Shoulders / torso — smooth bust shape */}
    <path
      d="M2 200 C2 145 20 120 60 115 C100 120 118 145 118 200 Z"
      fill="white"
      stroke="rgba(0,0,0,0.3)"
      strokeWidth="2"
    />
  </svg>
);

export const FramingGuideOverlay = ({ guide }: FramingGuideOverlayProps) => {
  const opacity = guide.opacity ?? 0.35;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex items-end pb-28 px-4 ${JUSTIFY[guide.position]}`}
      aria-hidden="true"
    >
      {/* Height 70 % of the container; aspect ratio matches the 120/200 viewBox */}
      <div className="h-[70%]" style={{ aspectRatio: '120 / 200' }}>
        <SilhouetteSvg opacity={opacity} />
      </div>
    </div>
  );
};
