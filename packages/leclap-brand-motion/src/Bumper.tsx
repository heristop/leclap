import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { OSWALD } from './fonts';

// The LeClap brand bumper: the playful clapper (vector) on a gradient disc with a gold ring.
// The clapper top is hinged at the board's top-left corner; it lifts open then SLAMS shut (the
// clack), then springs back open to rest. The slam is the beat the recoil, bloom, flash, and
// wordmark all key off — so the motion reads as cause-and-effect.
const LAVENDER = '#7C83FD';
const PINK = '#FF8AAE';
const YELLOW = '#FFE45E';
const INK = '#0b0b0f';
// Deeper disc gradient so the clapper reads clearly on it (matches the app icon / favicon).
const DISC_A = '#C3C7FF';
const DISC_B = '#FFCFDE';

// Clapper palette + geometry (sampled from the original logo; inline mark's 600 viewBox).
const OUTLINE = '#5E51AC';
const STRIPE_YELLOW = '#FEF0A6';
const STRIPE_PERI = '#8C80D8';
const HINGE = '140 250';
const OPEN = -25; // resting open angle — matches the static logo
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const Bumper = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const r = (s: number) => Math.round(s * fps);

  // Disc pops in with a springy overshoot, tilted for energy.
  const pop = spring({ frame, fps, durationInFrames: 22, config: { damping: 12, stiffness: 140, mass: 0.7 } });
  const popScale = interpolate(pop, [0, 1], [0.82, 1]);
  const popRotate = interpolate(pop, [0, 1], [-11, 0]);
  // Slow cinematic push-in across the whole clip.
  const push = interpolate(frame, [0, durationInFrames], [1, 1.06]);

  // Clap: closed → open → SLAM shut → settle open.
  const openFrame = r(0.5);
  const shutStart = r(0.86);
  const slamFrame = r(0.94);
  const lift = interpolate(frame, [openFrame, shutStart], [0, OPEN], CLAMP);
  const shut = interpolate(frame, [shutStart, slamFrame], [OPEN, 0], CLAMP);
  const reopen = spring({
    frame: frame - slamFrame,
    fps,
    durationInFrames: 18,
    config: { damping: 13, stiffness: 200, mass: 0.6 },
  });
  // closed→open (lift), then SLAM shut, then springy reopen — sequenced by frame.
  const angleFor = (): number => {
    if (frame < shutStart) return lift;

    if (frame < slamFrame) return shut;

    return interpolate(reopen, [0, 1], [0, OPEN]);
  };
  const angle = angleFor();

  // Impact at the clack: disc recoil, a light bloom, and a white flash.
  const impact = spring({
    frame: frame - slamFrame,
    fps,
    durationInFrames: 22,
    config: { damping: 8, stiffness: 260, mass: 0.5 },
  });
  const recoilY = interpolate(impact, [0, 0.3, 1], [0, 9, 0]);
  const recoilScale = interpolate(impact, [0, 0.3, 1], [1, 0.97, 1]);
  const bloom = interpolate(impact, [0, 0.25, 1], [0.16, 0.55, 0.22]);
  const flash = interpolate(frame, [slamFrame - 1, slamFrame + 1, slamFrame + 6], [0, 0.5, 0], CLAMP);

  // Wordmark blurs/rises in on the clack; tagline fades in just after.
  const wm = spring({ frame: frame - slamFrame, fps, durationInFrames: 22, config: { damping: 20, mass: 0.8 } });
  const tag = spring({ frame: frame - (slamFrame + r(0.2)), fps, durationInFrames: 18, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ backgroundColor: INK, justifyContent: 'center', alignItems: 'center' }}>
      {/* radial brand glow behind the mark — blooms on the clap */}
      <AbsoluteFill
        style={{ background: `radial-gradient(circle at 50% 44%, ${LAVENDER}, transparent 52%)`, opacity: bloom }}
      />
      <AbsoluteFill
        style={{ background: `radial-gradient(circle at 50% 108%, ${PINK}, transparent 45%)`, opacity: 0.12 }}
      />
      {/* vignette to settle the edges */}
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 48%, transparent 50%, rgba(0,0,0,0.55))' }} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 44,
          transform: 'translateY(-22px)',
        }}
      >
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: `radial-gradient(circle at 50% 16%, rgba(255,255,255,0.34), transparent 58%), linear-gradient(135deg, ${DISC_A}, ${DISC_B})`,
            border: `14px solid ${YELLOW}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 26px 55px rgba(0,0,0,0.5)',
            transform: `scale(${popScale * recoilScale * push}) rotate(${popRotate}deg) translateY(${recoilY}px)`,
          }}
        >
          <svg width={234} height={234} viewBox="0 0 600 600">
            <defs>
              <pattern
                id="lcPlayStripes"
                width="96"
                height="96"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-26)"
              >
                <rect width="96" height="96" fill={STRIPE_YELLOW} />
                <rect x="48" width="48" height="96" fill={STRIPE_PERI} />
              </pattern>
              {/* soft dark glow so the clapper separates from the deep gradient */}
              <filter id="lcGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#1C1540" floodOpacity="0.32" />
              </filter>
              {/* soft gradient for the pink body: lighter top → deeper bottom */}
              <linearGradient id="lcBoard" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#FFA0B7" />
                <stop offset="1" stopColor="#EE6184" />
              </linearGradient>
            </defs>
            <g filter="url(#lcGlow)">
              {/* board */}
              <rect
                x="96"
                y="302"
                width="408"
                height="194"
                rx="40"
                fill="url(#lcBoard)"
                stroke={OUTLINE}
                strokeWidth="24"
                strokeLinejoin="round"
              />
              {/* bottom clap (fixed) */}
              <rect
                x="132"
                y="252"
                width="372"
                height="58"
                rx="18"
                fill="url(#lcPlayStripes)"
                stroke={OUTLINE}
                strokeWidth="24"
                strokeLinejoin="round"
              />
              {/* top clap (raised) — sits ABOVE the bottom clap; rotates for the clap */}
              <g transform={`rotate(${angle} ${HINGE})`}>
                <rect
                  x="132"
                  y="192"
                  width="372"
                  height="58"
                  rx="18"
                  fill="url(#lcPlayStripes)"
                  stroke={OUTLINE}
                  strokeWidth="24"
                  strokeLinejoin="round"
                />
              </g>
              {/* hinge wedge: rounded vertical rect (w:h = 1:1.2) ON TOP, dot centered */}
              <rect
                x="90"
                y="216"
                width="80"
                height="96"
                rx="24"
                fill="url(#lcBoard)"
                stroke={OUTLINE}
                strokeWidth="24"
                strokeLinejoin="round"
              />
              <circle cx="130" cy="264" r="17" fill="#FFF6D0" stroke={OUTLINE} strokeWidth="6" />
            </g>
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              opacity: wm,
              transform: `translateY(${interpolate(wm, [0, 1], [26, 0])}px)`,
              filter: `blur(${interpolate(wm, [0, 1], [7, 0])}px)`,
              color: '#fff',
              fontFamily: OSWALD,
              fontWeight: 700,
              fontSize: 132,
              letterSpacing: 1,
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
            CINEMATIC VIDEOS, ANYWHERE
          </div>
        </div>
      </div>

      <AbsoluteFill style={{ backgroundColor: '#fff', opacity: flash }} />
    </AbsoluteFill>
  );
};
