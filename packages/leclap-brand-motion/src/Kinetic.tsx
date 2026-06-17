import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { OSWALD } from './fonts';

// A kinetic-typography title card: the wordmark reveals letter-by-letter on a staggered spring
// (each glyph rises + unblurs), an accent bar wipes in beneath it, and a soft radial glow drifts
// across the frame — per-letter spring physics an FFmpeg filtergraph can't express. Parametrized
// via inputProps (wordmark/tagline), 3s @ 30fps, renders cleanly at both aspects.
const INK = '#07080d';
const LAVENDER = '#7C83FD';
const PINK = '#FF8AAE';

export interface KineticProps {
  wordmark?: string;
  tagline?: string;
}

export const Kinetic = ({ wordmark = 'LeClap', tagline = 'MOTION, AUTHORED' }: KineticProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  // Split into code points without the spread operator (no-misused-spread) or Array.from (prefer-spread).
  const letters = wordmark.match(/./gu) ?? [];

  // Slow glow drift across the frame for life behind the lockup.
  const driftX = interpolate(frame, [0, durationInFrames], [38, 62]);

  // Accent bar wipes in once most letters have landed.
  const barStart = Math.round(0.85 * fps);
  const bar = spring({ frame: frame - barStart, fps, durationInFrames: 20, config: { damping: 18, mass: 0.7 } });

  // Tagline rises in just after the bar.
  const tagStart = Math.round(1.25 * fps);
  const tag = spring({ frame: frame - tagStart, fps, durationInFrames: 18, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ backgroundColor: INK, justifyContent: 'center', alignItems: 'center' }}>
      <AbsoluteFill
        style={{ background: `radial-gradient(circle at ${driftX}% 42%, ${LAVENDER}40, transparent 55%)` }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 120%, ${PINK}22, transparent 45%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 48%, transparent 52%, rgba(0,0,0,0.5))' }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
        <div
          style={{ display: 'flex', fontFamily: OSWALD, fontWeight: 700, fontSize: 150, color: '#fff', lineHeight: 1 }}
        >
          {letters.map((char, index) => {
            const enter = spring({
              frame: frame - index * 2,
              fps,
              durationInFrames: 22,
              config: { damping: 14, stiffness: 170, mass: 0.6 },
            });

            return (
              <span
                key={`${index}-${char}`}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'pre',
                  opacity: enter,
                  transform: `translateY(${interpolate(enter, [0, 1], [68, 0])}px)`,
                  filter: `blur(${interpolate(enter, [0, 1], [9, 0])}px)`,
                }}
              >
                {char === ' ' ? ' ' : char}
              </span>
            );
          })}
        </div>

        <div
          style={{
            width: interpolate(bar, [0, 1], [0, 280]),
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${LAVENDER}, ${PINK})`,
          }}
        />

        <div
          style={{
            opacity: tag,
            transform: `translateY(${interpolate(tag, [0, 1], [16, 0])}px)`,
            color: PINK,
            fontFamily: OSWALD,
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: 6,
            textTransform: 'uppercase',
          }}
        >
          {tagline}
        </div>
      </div>
    </AbsoluteFill>
  );
};
