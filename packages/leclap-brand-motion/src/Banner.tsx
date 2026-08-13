import { AbsoluteFill, Img, staticFile } from 'remotion';
import { OSWALD } from './fonts';
import { LAVENDER, PINK, INK, BRAND_GRADIENT } from './brand';

// A wide logotype banner (3.33:1), rendered as a still for link-in-bio cards and README headers.
// Static by design — no interpolation, no frame dependency — so it renders identically at any frame
// and any scale. The mark is the real logo.png rather than the Bumper's inline SVG: nothing here
// animates, so there's no reason to redraw it.

export interface BannerProps {
  wordmark?: string;
  tagline?: string;
}

export const Banner = ({ wordmark = 'LeClap', tagline = 'ON-DEVICE VIDEO COMPOSER' }: BannerProps) => (
  <AbsoluteFill
    style={{
      backgroundColor: INK,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '3.2%',
      fontFamily: OSWALD,
    }}
  >
    {/* Two soft brand glows so the dark ground never reads flat, mirroring the promos' DriftGlow
        without the drift. */}
    <AbsoluteFill
      style={{
        background: `radial-gradient(38% 90% at 22% 40%, ${LAVENDER}33, transparent 70%),
          radial-gradient(42% 95% at 82% 90%, ${PINK}2b, transparent 70%)`,
      }}
    />

    <Img src={staticFile('logo.png')} style={{ height: '68%', width: 'auto', display: 'block' }} />

    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div
        style={{
          fontSize: '6.6rem',
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.01em',
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
      {/* The negative right margin cancels the trailing letter-space so the block stays optically
          centred under the wordmark. */}
      <div
        style={{
          fontSize: '1.3rem',
          fontWeight: 500,
          letterSpacing: '0.34em',
          marginRight: '-0.34em',
          color: '#b9b7cc',
        }}
      >
        {tagline}
      </div>
    </div>
  </AbsoluteFill>
);
