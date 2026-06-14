import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BEBAS, OSWALD } from './fonts';

// The LeClap clapperboard "clap" intro, rendered with Remotion springs so the motion has real
// physics (the splash + the old SVG script were hand-eased). Same favicon geometry as
// apps/leclap-web/.../brand/AnimatedLogo.tsx — the hinged clapper `<g>` rotates at its hinge.
const GRAD = 'lcBumperGrad';
const LAVENDER = '#7C83FD';
const PINK = '#FF8AAE';
const INK = '#0b0b0f';

export const Bumper = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Badge pops in (overshoots via a springy, under-damped config).
  const pop = spring({ frame, fps, durationInFrames: 20, config: { damping: 11, stiffness: 150, mass: 0.7 } });
  const scale = interpolate(pop, [0, 1], [0.82, 1]);

  // Clapper snaps shut: open -34° → 0°, overshooting past closed before settling.
  const clap = spring({
    frame: frame - Math.round(0.36 * fps),
    fps,
    durationInFrames: 18,
    config: { damping: 9, stiffness: 220, mass: 0.6 },
  });
  const angle = interpolate(clap, [0, 1], [-34, 0]);

  // White flash on the snap impact.
  const flashStart = Math.round(0.5 * fps);
  const flash = interpolate(frame, [flashStart - 1, flashStart + 1, flashStart + 6], [0, 0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Wordmark + tagline rise in after the clap.
  const wm = spring({ frame: frame - Math.round(0.7 * fps), fps, durationInFrames: 16, config: { damping: 16 } });
  const tag = spring({ frame: frame - Math.round(0.95 * fps), fps, durationInFrames: 16, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ backgroundColor: INK, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: LAVENDER }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, background: PINK }} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 44,
          transform: 'translateY(-26px)',
        }}
      >
        <svg width={300} height={300} viewBox="0 0 512 512" style={{ transform: `scale(${scale})` }}>
          <defs>
            <linearGradient id={GRAD} x1="80" y1="64" x2="432" y2="448" gradientUnits="userSpaceOnUse">
              <stop stopColor={LAVENDER} />
              <stop offset="1" stopColor={PINK} />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="116" fill={`url(#${GRAD})`} />
          <g transform="rotate(-9 256 248)">
            <rect x="124" y="172" width="264" height="200" rx="22" fill="#fff" />
            <path d="M230 232v96l82-48z" fill={`url(#${GRAD})`} />
            <g transform={`rotate(${angle} 120 150)`}>
              <rect x="112" y="100" width="288" height="58" rx="14" fill="#fff" />
              <g fill={`url(#${GRAD})`}>
                <path d="M150 100h36l-24 58h-36z" />
                <path d="M214 100h36l-24 58h-36z" />
                <path d="M278 100h36l-24 58h-36z" />
                <path d="M342 100h30l-24 58h-30z" />
              </g>
            </g>
          </g>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              opacity: wm,
              transform: `translateY(${interpolate(wm, [0, 1], [16, 0])}px)`,
              color: '#fff',
              fontFamily: BEBAS,
              fontSize: 150,
              letterSpacing: 3,
              lineHeight: 1,
            }}
          >
            LeClap
          </div>
          <div
            style={{
              opacity: tag,
              color: PINK,
              fontFamily: OSWALD,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: 4,
            }}
          >
            CINEMATIC VIDEOS IN YOUR BROWSER
          </div>
        </div>
      </div>

      <AbsoluteFill style={{ backgroundColor: '#fff', opacity: flash }} />
    </AbsoluteFill>
  );
};
