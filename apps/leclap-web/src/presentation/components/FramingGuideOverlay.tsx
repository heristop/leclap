import { useId } from 'react';
import type { FramingGuideConfig } from 'ffmpeg-video-composer/src/core/types.d.ts';
import { DEFAULT_FRAMING_OPACITY } from '@/presentation/components/admin/templateEditorModel';
import { guideLayers } from './framing-guide.logic';

interface FramingGuideOverlayProps {
  guide: FramingGuideConfig;
  // The take is rolling: the guide steps back so it doesn't sit on the person being filmed.
  recording?: boolean;
}

// Where the bust's centre sits across the frame: on the left third, the middle or the right third, so
// left / center / right read as three distinct spots in any frame shape. Screen space: the front camera's
// preview is mirrored, and the guide is laid over that mirrored picture, so 'left' stays on the viewer's
// left. Shared with the admin picker's mockup, which imports silhouetteDockClass, so the preview there and
// the live overlay always agree.
export const SILHOUETTE_POSITION_CLASS: Record<FramingGuideConfig['position'], string> = {
  left: 'left-1/3',
  center: 'left-1/2',
  right: 'left-2/3',
};

// The box the drawing lives in: the frame's full height, at the drawing's own aspect, centred on the
// chosen spot — whatever overhangs the frame is clipped by it. Sized from the height, the bust keeps the
// same scale in a 16:9, 1:1 or 9:16 frame (a head at ~40% of the height), which is why the frame shape no
// longer changes it; the parameter stays for the admin mockup's call. On a phone's full-screen viewfinder
// (~0.46) that head spans about two thirds of the width, which is what a selfie at arm's length looks like.
export const silhouetteDockClass = (_isPortrait: boolean, position: FramingGuideConfig['position']): string =>
  `absolute inset-y-0 aspect-[240/250] -translate-x-1/2 ${SILHOUETTE_POSITION_CLASS[position]}`;

// A webcam medium close-up, drawn as one continuous contour in a 240×250 box that spans the frame's
// height: an egg-shaped head (78 wide, 100 crown-to-chin: ~0.78, 40% of the frame) with ~13% headroom and
// the eye line near the upper third; a short neck (~0.6 of the head's width) flaring into the trapezius;
// shoulders sloping out to ~2.4× the head's width, then the arms leaving through the bottom of the frame.
// The chin sits inside the outline, as it does in a real frontal silhouette. The path closes far below
// the box, so no base line ever shows on screen.
const SILHOUETTE = [
  'M120 32 C97 32 81 49 81 71 C81 87 84 99 90 107 C92.6 110.4 95.6 113.6 96.8 117.5',
  'C97.4 121.5 97.2 125 95.8 128.5 C92.8 135.5 80.5 141.5 65 146.5 C49 151.5 37.5 159 31 172',
  'C25.8 182.5 23 199 21 226 L18 400 L222 400 L219 226 C217 199 214.2 182.5 209 172',
  'C202.5 159 191 151.5 175 146.5 C159.5 141.5 147.2 135.5 144.2 128.5 C142.8 125 142.6 121.5 143.2 117.5',
  'C144.4 113.6 147.4 110.4 150 107 C156 99 159 87 159 71 C159 49 143 32 120 32 Z',
].join(' ');

// Far enough past the box to cover the widest frame around it; the frame's own overflow clips it.
const BEYOND = { x: -2000, y: -2000, width: 4240, height: 4250 };

// Where the lines fade out as the arms leave the frame, so the guide doesn't end on a hard cut.
const FADE = { x1: 0, y1: 196, x2: 0, y2: 250 };

// How much of the guide stays up while recording: a trace to re-centre on, not a line across the take.
const RECORDING_PRESENCE = 0.15;

// Drawn in layers, each at the strength guideLayers derives from the template's opacity. 'bust' first
// shades the frame OUTSIDE the contour, through a feathered mask, so the subject zone reads as the sweet
// spot without a hard cutout and without touching the person in it. Then a soft dark halo, so the line
// holds on bright and busy feeds, and the 2px light line itself, with round joins. The line doesn't scale
// with the frame (a hairline in the admin mockup and on a desktop viewfinder alike); the halo and the
// feather do, so they stay in proportion. 'outline' is the halo and line alone.
export const SilhouetteSvg = ({ opacity, style }: { opacity: number; style: 'bust' | 'outline' }) => {
  // useId's colons would need escaping inside url(#…), so keep the ids to plain characters.
  const id = `framing-${useId().replace(/[^\w-]/g, '')}`;
  const layers = guideLayers(opacity);

  return (
    <svg viewBox="0 0 240 250" className="h-full w-full overflow-visible" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-line`} gradientUnits="userSpaceOnUse" {...FADE}>
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`${id}-halo`} gradientUnits="userSpaceOnUse" {...FADE}>
          <stop offset="0" stopColor="black" />
          <stop offset="1" stopColor="black" stopOpacity={0} />
        </linearGradient>
        <filter id={`${id}-soft`} x="-10%" y="-10%" width="120%" height="140%">
          <feGaussianBlur stdDeviation={0.7} />
        </filter>
        {style === 'bust' && (
          <>
            <filter id={`${id}-feather`} x="-20%" y="-20%" width="140%" height="160%">
              <feGaussianBlur stdDeviation={5} />
            </filter>
            <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" {...BEYOND}>
              <rect {...BEYOND} fill="white" />
              <path d={SILHOUETTE} fill="black" filter={`url(#${id}-feather)`} />
            </mask>
          </>
        )}
      </defs>
      {style === 'bust' && <rect {...BEYOND} fill="black" fillOpacity={layers.dim} mask={`url(#${id}-mask)`} />}
      <path
        d={SILHOUETTE}
        fill="none"
        stroke={`url(#${id}-halo)`}
        strokeOpacity={layers.halo}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${id}-soft)`}
      />
      <path
        d={SILHOUETTE}
        fill="none"
        stroke={`url(#${id}-line)`}
        strokeOpacity={layers.line}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

// The live overlay over the camera preview. It is page chrome, never part of the recording. Once the
// take starts it steps back quickly (a short fade, a cut under reduced motion) to a trace.
export const FramingGuideOverlay = ({ guide, recording = false }: FramingGuideOverlayProps) => (
  <div
    className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200 ease-out motion-reduce:transition-none"
    style={{ opacity: recording ? RECORDING_PRESENCE : 1 }}
    aria-hidden="true"
  >
    <div className={silhouetteDockClass(false, guide.position)}>
      <SilhouetteSvg opacity={guide.opacity ?? DEFAULT_FRAMING_OPACITY} style={guide.style ?? 'bust'} />
    </div>
  </div>
);
