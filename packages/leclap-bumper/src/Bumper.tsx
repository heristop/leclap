import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BEBAS, OSWALD } from './fonts';

// The LeClap clapperboard "clap" intro. The clapper stick is hinged at the slate's TOP-LEFT corner
// (pivot 116,188) and lies flush on the slate's top edge when closed — so the snap reads as a real
// clapperboard clacking shut, not a bar floating away from the board. Springs give the motion
// physics; a drop shadow + slow push-in add depth.
const GRAD = 'lcBumperGrad';
const LAVENDER = '#7C83FD';
const PINK = '#FF8AAE';
const INK = '#0b0b0f';

// Clapper hinge (slate top-left). Small open angle, held only briefly, so the board reads as the
// clean closed icon most of the time and the clap is a quick accent rather than a distorted pose.
const HINGE = '116 188';
const OPEN_ANGLE = -18;

const TEETH = [130, 172, 214, 256, 298, 340];

export const Bumper = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Badge pops in with a springy overshoot.
  const pop = spring({ frame, fps, durationInFrames: 20, config: { damping: 11, stiffness: 150, mass: 0.7 } });
  const popScale = interpolate(pop, [0, 1], [0.84, 1]);
  // Slow cinematic push-in across the whole clip.
  const push = interpolate(frame, [0, durationInFrames], [1, 1.05]);

  // Clap gesture: the board enters closed, the clapper flicks open a touch, then SLAMS shut (the
  // clack) with a slight overshoot. Held-closed most of the time keeps the icon clean.
  const openFrame = Math.round(0.42 * fps);
  const slamFrame = Math.round(0.62 * fps);
  const opened = interpolate(frame, [openFrame, slamFrame], [0, OPEN_ANGLE], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slam = spring({
    frame: frame - slamFrame,
    fps,
    durationInFrames: 9,
    config: { damping: 10, stiffness: 300, mass: 0.5 },
  });
  const angle = frame < slamFrame ? opened : interpolate(slam, [0, 1], [OPEN_ANGLE, 0]);

  // White flash at the slam contact.
  const flashStart = slamFrame + 3;
  const flash = interpolate(frame, [flashStart - 1, flashStart + 1, flashStart + 6], [0, 0.8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Wordmark + tagline rise in after the clap lands.
  const wm = spring({ frame: frame - Math.round(0.82 * fps), fps, durationInFrames: 16, config: { damping: 16 } });
  const tag = spring({ frame: frame - Math.round(1.04 * fps), fps, durationInFrames: 16, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ backgroundColor: INK, justifyContent: 'center', alignItems: 'center' }}>
      {/* radial brand glow behind the mark */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, ${LAVENDER}22, transparent 55%)` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: LAVENDER }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, background: PINK }} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 46,
          transform: `scale(${push}) translateY(-24px)`,
        }}
      >
        <svg
          width={300}
          height={300}
          viewBox="0 0 512 512"
          style={{ transform: `scale(${popScale})`, filter: 'drop-shadow(0 26px 55px rgba(0,0,0,0.5))' }}
        >
          <defs>
            <linearGradient id={GRAD} x1="80" y1="64" x2="432" y2="448" gradientUnits="userSpaceOnUse">
              <stop stopColor={LAVENDER} />
              <stop offset="1" stopColor={PINK} />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="116" fill={`url(#${GRAD})`} />
          <g transform="rotate(-8 256 256)">
            {/* slate (board) + play cue */}
            <rect x="116" y="188" width="280" height="196" rx="24" fill="#fff" />
            <path d="M232 252v68l60-34z" fill={`url(#${GRAD})`} />
            {/* hinged clapper stick: flush on the slate top when closed, swings up at the left hinge */}
            <g transform={`rotate(${angle} ${HINGE})`}>
              <rect x="116" y="136" width="280" height="52" rx="12" fill="#fff" />
              <g fill={`url(#${GRAD})`}>
                {TEETH.map((x) => (
                  <path key={x} d={`M${x} 136h26l-15 52h-26z`} />
                ))}
              </g>
            </g>
          </g>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              opacity: wm,
              transform: `translateY(${interpolate(wm, [0, 1], [18, 0])}px)`,
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
            CINEMATIC VIDEOS, ANYWHERE
          </div>
        </div>
      </div>

      <AbsoluteFill style={{ backgroundColor: '#fff', opacity: flash }} />
    </AbsoluteFill>
  );
};
