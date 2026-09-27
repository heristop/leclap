import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, PINK, YELLOW } from '../../brand';
import { CLAMP, EASE, TrackingTitle } from '../../film/cinema';
import { ClapBody, useBlink, useClap, useLook } from '../../film/acting';
import { Clappy, type ClappyMood } from '../../film/clappy';
import { useT } from '../../film/lang';
import { COPY } from '../copy';
import { CLAPS, FPS } from '../timeline';

// 0–6s · Cold open. A dark theatre, a spotlight eases on, the velvet stays shut while the narrator
// asks the question. Clappy pops up at the foot of the stage, looks around, and slams shut — and that clap
// is what throws the curtains open. (The Opus 5.5 film opened on red curtains too; ours are brand plum.)

const SLAM = Math.round(CLAPS[0] * FPS);
const VELVET_DARK = '#2a0b26';
const VELVET = '#6d1d4f';
const VELVET_LIGHT = '#b34a7e';

export const CurtainScene = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = useT();

  // The spotlight eases on — one smooth fade. (A stuttering follow-spot read as blinking, not as a light.)
  const spot = interpolate(frame, [2, 26], [0, 1], { ...CLAMP, easing: EASE.inOutCubic });

  // Curtains throw open on the slam (ease-in, then they gather at the wings).
  const open = interpolate(frame, [SLAM + 2, SLAM + 22], [0, 1], CLAMP) ** 2.1;

  // Clappy pops up at the foot of the stage (overshoot + settle), looks around — eyes first, body after —
  // waves hello, crouches with its arms up (anticipation), SLAMS, then springs up and out of frame.
  const rise = spring({ frame: frame - 100, fps, config: { damping: 9, stiffness: 130, mass: 0.8 } });
  const { eyes, head } = useLook([
    [106, 0],
    [112, -1],
    [122, -1],
    [127, 1],
    [134, 1],
    [139, 0],
  ]);
  const waving = frame >= 116 && frame < 140;
  const wave = waving ? 150 + Math.sin((frame - 116) * 0.7) * 24 : 28;
  const crouch = interpolate(frame, [SLAM - 14, SLAM - 4], [0, 1], { ...CLAMP, easing: EASE.outCubic });
  const armsUp = interpolate(frame, [SLAM - 14, SLAM - 5, SLAM, SLAM + 6], [28, 165, 60, 40], CLAMP);
  const jump = interpolate(frame, [SLAM + 5, SLAM + 22], [0, 1], { ...CLAMP, easing: EASE.inQuad });
  const { angle, impact } = useClap(SLAM);
  const blink = useBlink(20);
  const squashX = 1 + crouch * 0.1 * (1 - jump) + impact * 0.12 - jump * 0.16;
  const squashY = 1 - crouch * 0.12 * (1 - jump) - impact * 0.14 + jump * 0.28;
  const idleSwing = Math.sin(frame / 7) * 6;

  const line1 = interpolate(frame, [80, 92], [1, 0], CLAMP);
  const line2 = interpolate(frame, [SLAM - 2, SLAM + 6], [1, 0], CLAMP);

  return (
    <AbsoluteFill style={{ background: '#050308', overflow: 'hidden' }}>
      {/* the stage behind the curtain, glimpsed as it opens */}
      <AbsoluteFill
        style={{ background: `radial-gradient(1200px 700px at 50% 70%, ${LAVENDER}66, transparent 70%), #0d0b18` }}
      />

      <Curtain side="left" open={open} width={width} height={height} />
      <Curtain side="right" open={open} width={width} height={height} />
      <Valance width={width} />

      {/* the spotlight: one soft pool on the velvet, where Clappy will pop up */}
      <AbsoluteFill
        style={{
          opacity: spot * (1 - open),
          mixBlendMode: 'screen',
          background: 'radial-gradient(760px 460px at 50% 76%, rgba(255,240,220,0.32), transparent 70%)',
        }}
      />

      {/* the questions, projected onto the velvet */}
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: height * 0.28, opacity: (1 - open) * spot }}>
        {/* a soft shadow on the velvet behind the words, so the pastel gradient holds against the magenta */}
        <div
          style={{
            position: 'absolute',
            left: width / 2 - 720,
            top: height * 0.16,
            width: 1440,
            height: 460,
            background: 'radial-gradient(closest-side, rgba(14,4,26,0.66), rgba(14,4,26,0.34) 60%, transparent)',
          }}
        />
        <div style={{ opacity: line1, position: 'absolute', top: height * 0.3 }}>
          <TrackingTitle text={t(COPY.curtain.idea)} start={27} size={70} />
        </div>
        <div
          style={{
            opacity: line2,
            position: 'absolute',
            top: height * 0.24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            filter: 'drop-shadow(0 6px 22px rgba(10,2,24,0.8))',
          }}
        >
          <TrackingTitle text={t(COPY.curtain.whatIf)} start={93} size={62} weight={500} />
          <TrackingTitle text={t(COPY.curtain.wasATemplate)} start={106} size={120} gradient />
        </div>
      </AbsoluteFill>

      {/* Clappy at the foot of the stage */}
      <div style={{ position: 'absolute', left: width / 2 - 170, top: height * 0.6 }}>
        <ClapBody
          y={interpolate(rise, [0, 1], [460, 0]) - jump * 1350}
          sx={squashX}
          sy={squashY}
          rotate={head * 7 + jump * -10}
        >
          <Clappy
            size={340}
            angle={angle}
            lookX={eyes}
            lookY={-0.25}
            blink={blink}
            mood={curtainMood(frame)}
            armL={frame > SLAM - 14 ? armsUp : 28 + idleSwing}
            armR={frame > SLAM - 14 ? armsUp : wave}
          />
        </ClapBody>
      </div>
    </AbsoluteFill>
  );
};

/** Smiling while it waves, focused through the wind-up, grinning once the curtain flies. */
const curtainMood = (frame: number): ClappyMood => {
  if (frame > SLAM + 3) return 'grin';

  if (frame > SLAM - 14) return 'focused';

  return 'smile';
};

const Curtain = ({
  side,
  open,
  width,
  height,
}: {
  side: 'left' | 'right';
  open: number;
  width: number;
  height: number;
}) => {
  const dir = side === 'left' ? -1 : 1;
  const half = width / 2 + 40;
  // Folds bunch up (narrower period) as the drape is pulled to the wing.
  const fold = 120 - open * 70;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: half,
        [side]: 0,
        transform: `translateX(${dir * open * half * 0.92}px) scaleX(${1 - open * 0.45})`,
        transformOrigin: side === 'left' ? '0% 50%' : '100% 50%',
        background: `repeating-linear-gradient(90deg, ${VELVET_DARK} 0px, ${VELVET} ${fold * 0.3}px, ${VELVET_LIGHT} ${fold * 0.5}px, ${VELVET} ${fold * 0.7}px, ${VELVET_DARK} ${fold}px)`,
        boxShadow: `inset ${-dir * 60}px 0 80px rgba(0,0,0,0.6)`,
      }}
    >
      {/* floor shadow and top falloff so the drape has weight */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(0,0,0,0.55), transparent 30%, transparent 75%, rgba(0,0,0,0.6))`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(${height}px ${height * 0.7}px at ${side === 'left' ? '100%' : '0%'} 60%, ${PINK}22, transparent 70%)`,
        }}
      />
    </div>
  );
};

/** The pelmet across the top with a gold fringe — frames the whole cold open as a stage. */
const Valance = ({ width }: { width: number }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, width, height: 150 }}>
    <svg width={width} height={150} viewBox={`0 0 ${width} 150`}>
      <defs>
        <linearGradient id="valance" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a0616" />
          <stop offset="1" stopColor={VELVET} />
        </linearGradient>
      </defs>
      <path
        d={`M0 0 H${width} V100 ${Array.from({ length: 12 }, (_, index) => {
          const x0 = width - (index * width) / 12;
          const x1 = width - ((index + 1) * width) / 12;

          return `Q${(x0 + x1) / 2} 150 ${x1} 100`;
        }).join(' ')} Z`}
        fill="url(#valance)"
      />
      <path
        d={`M0 100 ${Array.from({ length: 12 }, (_, index) => {
          const x0 = (index * width) / 12;
          const x1 = ((index + 1) * width) / 12;

          return `Q${(x0 + x1) / 2} 150 ${x1} 100`;
        }).join(' ')}`}
        fill="none"
        stroke={YELLOW}
        strokeWidth={5}
        opacity={0.8}
      />
    </svg>
  </div>
);
