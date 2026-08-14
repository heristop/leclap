import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { OSWALD } from './fonts';
import { LAVENDER, PINK, INK, BRAND_GRADIENT } from './brand';

// The README hero: a phone rendering a LeClap template on-device, beside the claim no cloud renderer
// can make. The clip in public/captures/ondevice-render.mp4 is the tail of the Android demo — tap
// "Create my video", the render runs on the handset, then the finished video plays back.
//
// This composition exists to be encoded as a GIF (render-hero.ts), which changes how it is built.
// A GIF only pays for pixels that change between frames, so everything outside the phone screen holds
// perfectly still: the background glow is static (not the promos' drifting DriftGlow, which would
// touch every pixel of every frame), nothing springs in, and the copy changes exactly once. That one
// handover is what keeps the file inside the budget a README hero has to hit — a hero nobody waits
// for is a hero nobody sees.

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Aspect of the source capture (452x928), so the screen cut-out matches the footage exactly. */
const SCREEN_ASPECT = 452 / 928;

/** The frame the phone hands over from "rendering" to playing the finished video. Read off the clip. */
const HANDOVER = 129;

interface Beat {
  kicker: string;
  headline: string;
  sub: string;
}

const BEATS: readonly Beat[] = [
  {
    kicker: 'RENDERING ON THE PHONE',
    headline: 'No server. No upload.',
    sub: 'FFmpeg is linked into the app — the render runs on the handset.',
  },
  {
    kicker: 'DONE, ON-DEVICE',
    headline: 'Your video, ready.',
    sub: 'One JSON template — the same one renders on Node and in the browser.',
  },
];

export interface OnDeviceHeroProps {
  wordmark?: string;
}

export const OnDeviceHero = ({ wordmark = 'LeClap' }: OnDeviceHeroProps) => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: INK,
        fontFamily: OSWALD,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: width * 0.055,
      }}
    >
      {/* Static brand glows so the dark ground never reads flat. Fixed, unlike the promos' DriftGlow:
          a moving gradient is invisible at this scale and ruinous to the GIF. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(${width * 0.4}px ${height * 0.75}px at 24% 38%, ${LAVENDER}33, transparent 70%),
            radial-gradient(${width * 0.45}px ${height * 0.8}px at 88% 96%, ${PINK}2b, transparent 70%)`,
        }}
      />

      <Phone />
      <Copy wordmark={wordmark} />
    </AbsoluteFill>
  );
};

// The handset: a plain rounded bezel around the capture. No notch or speaker slit — at the size a
// README renders this, they would be two grey smudges.
const Phone = () => {
  const { height } = useVideoConfig();
  const outerHeight = height * 0.93;
  const bezel = height * 0.02;
  const screenHeight = outerHeight - bezel * 2;
  const outerWidth = screenHeight * SCREEN_ASPECT + bezel * 2;

  return (
    <div
      style={{
        width: outerWidth,
        height: outerHeight,
        flexShrink: 0,
        padding: bezel,
        borderRadius: outerWidth * 0.1,
        background: '#07070b',
        border: '1px solid rgba(255,255,255,0.16)',
        boxShadow: `0 ${height * 0.03}px ${height * 0.09}px rgba(0,0,0,0.6)`,
      }}
    >
      {/* The capture is cropped out of a screen recording that already sat in a rounded device
          mockup, so the clip's own corners are rounded. This radius is set a touch wider than
          theirs, which masks them instead of leaving four bright crescents. */}
      <div style={{ width: '100%', height: '100%', borderRadius: outerWidth * 0.092, overflow: 'hidden' }}>
        <OffthreadVideo
          src={staticFile('captures/ondevice-render.mp4')}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    </div>
  );
};

const Copy = ({ wordmark }: { wordmark: string }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Sequential, not cross-faded: two headlines dissolving through each other read as neither.
  const opacities = [
    interpolate(frame, [HANDOVER - 9, HANDOVER - 3], [1, 0], CLAMP),
    interpolate(frame, [HANDOVER - 2, HANDOVER + 7], [0, 1], CLAMP),
  ];

  // The column is capped rather than `flex: 1`: at full width the sub-line sets as one long line and
  // the pair drifts left of frame. A fixed width keeps phone + copy optically centred as one unit.
  return (
    <div style={{ width: width * 0.47, display: 'flex', flexDirection: 'column', gap: height * 0.055 }}>
      <div
        style={{
          fontSize: width * 0.076,
          fontWeight: 700,
          lineHeight: 1.05,
          background: BRAND_GRADIENT,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          // Descenders ("p") clip against background-clip:text without room below the baseline.
          paddingBottom: '0.1em',
        }}
      >
        {wordmark}
      </div>

      {/* Both beats are stacked in a fixed-height box, so swapping them cannot reflow the column. */}
      <div style={{ position: 'relative', height: height * 0.36 }}>
        {BEATS.map((beat, index) => (
          <BeatBlock key={beat.kicker} beat={beat} opacity={opacities[index]} />
        ))}
      </div>
    </div>
  );
};

const BeatBlock = ({ beat, opacity }: { beat: Beat; opacity: number }) => {
  const { width } = useVideoConfig();

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity }}>
      <div
        style={{
          display: 'inline-block',
          fontSize: width * 0.0165,
          letterSpacing: width * 0.0035,
          fontWeight: 600,
          color: '#fff',
          background: BRAND_GRADIENT,
          padding: `${width * 0.005}px ${width * 0.016}px`,
          borderRadius: 999,
          marginBottom: width * 0.019,
        }}
      >
        {beat.kicker}
      </div>
      <div style={{ fontSize: width * 0.048, fontWeight: 700, lineHeight: 1.06, color: '#fff' }}>{beat.headline}</div>
      <div style={{ fontSize: width * 0.022, fontWeight: 300, color: '#c9cbe0', marginTop: width * 0.016 }}>
        {beat.sub}
      </div>
    </div>
  );
};
