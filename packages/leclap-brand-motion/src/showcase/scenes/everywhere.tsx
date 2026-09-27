import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, PINK, YELLOW } from '../../brand';
import { OSWALD } from '../../fonts';
import { CLAMP, DriftGlow, KineticWords, SceneShell } from '../../film/cinema';
import { MONO } from '../../film/devices';
import { type Bilingual, useLang, useT } from '../../film/lang';
import { COPY } from '../copy';

// 18–24s · One template, three runtimes. The template sits at the hub; Node, the browser and the phone
// fly in from deep space on consecutive beats and wire themselves to it. Exit: the camera dives into the
// browser card — the next scene is the desktop.

interface Target {
  title: Bilingual;
  sub: Bilingual;
  code: Bilingual;
  glyph: 'terminal' | 'browser' | 'phone';
}

const TARGETS: readonly Target[] = [
  { ...COPY.everywhere.node, glyph: 'terminal' },
  { ...COPY.everywhere.browser, glyph: 'browser' },
  { ...COPY.everywhere.phone, glyph: 'phone' },
];

const CARD_W = 470;
const CARD_H = 290;
const GAP = 70;
const ROW_TOP = 600;
const HUB = { x: 960, y: 420 };

export const EverywhereScene = () => (
  <SceneShell enter="whip" exit="zoom" exitOrigin="50% 68%" exitFrames={12}>
    <EverywhereBody />
  </SceneShell>
);

type Point = readonly [number, number];

/** A point `t` (0..1) along a cubic Bézier. */
const bezier = ([p0, p1, p2, p3]: readonly [Point, Point, Point, Point], t: number): Point => {
  const u = 1 - t;
  const at = (axis: 0 | 1) =>
    u ** 3 * p0[axis] + 3 * u * u * t * p1[axis] + 3 * u * t * t * p2[axis] + t ** 3 * p3[axis];

  return [at(0), at(1)];
};

const EverywhereBody = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = useT();
  const lang = useLang();
  const orbitY = interpolate(frame, [0, durationInFrames], [-6, 6]);
  const tiltX = interpolate(frame, [0, durationInFrames], [12, 5]);
  const hub = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 150 } });
  const rowLeft = 960 - (CARD_W * 3 + GAP * 2) / 2;

  return (
    <AbsoluteFill style={{ background: '#0b0a14' }}>
      <DriftGlow hueA={PINK} hueB={LAVENDER} />
      <Starfield />

      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 100 }}>
        <KineticWords
          text={t(COPY.everywhere.headline)}
          start={2}
          size={96}
          gradientWords={COPY.everywhere.headlineGradient[lang]}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ perspective: 1600 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${tiltX}deg) rotateY(${orbitY}deg)`,
          }}
        >
          <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
            <defs>
              {/* user-space units: the middle wire is a straight vertical line, whose bounding box has no
                  width — a bounding-box gradient would leave it unpainted */}
              <linearGradient id="wire" gradientUnits="userSpaceOnUse" x1={0} y1={HUB.y + 60} x2={0} y2={ROW_TOP}>
                <stop offset="0" stopColor={LAVENDER} />
                <stop offset="1" stopColor={PINK} />
              </linearGradient>
            </defs>
            {TARGETS.map((target, index) => {
              const cx = rowLeft + index * (CARD_W + GAP) + CARD_W / 2;
              const draw = interpolate(frame, [20 + index * 15, 40 + index * 15], [0, 1], CLAMP);
              const points = [
                [HUB.x, HUB.y + 60],
                [HUB.x, HUB.y + 130],
                [cx, ROW_TOP - 90],
                [cx, ROW_TOP],
              ] as const;
              const d = `M${points[0].join(' ')} C ${points[1].join(' ')}, ${points[2].join(' ')}, ${points[3].join(' ')}`;
              const pulse = ((frame - 40 - index * 15) / 30) % 1;
              const [px, py] = bezier(points, pulse);

              return (
                <g key={target.glyph}>
                  <path
                    d={d}
                    fill="none"
                    stroke="url(#wire)"
                    strokeWidth={3}
                    pathLength={1}
                    strokeDasharray="1 1"
                    strokeDashoffset={1 - draw}
                    opacity={0.8}
                  />
                  {draw >= 1 && pulse >= 0 && (
                    <circle cx={px} cy={py} r={7} fill="#fff" style={{ filter: `drop-shadow(0 0 8px ${PINK})` }} />
                  )}
                </g>
              );
            })}
          </svg>

          {/* the hub: the template itself */}
          <div
            style={{
              position: 'absolute',
              left: HUB.x - 150,
              top: HUB.y - 60,
              width: 300,
              height: 120,
              borderRadius: 18,
              background: `linear-gradient(135deg, ${LAVENDER}, ${PINK})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              fontFamily: MONO,
              fontSize: 28,
              color: '#fff',
              fontWeight: 700,
              transform: `scale(${hub}) translateZ(60px)`,
              boxShadow: `0 0 ${50 + Math.sin(frame / 6) * 20}px ${LAVENDER}`,
            }}
          >
            {'{ }'} template.json
          </div>

          {TARGETS.map((target, index) => (
            <TargetCard key={target.glyph} target={target} index={index} left={rowLeft + index * (CARD_W + GAP)} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const TargetCard = ({ target, index, left }: { target: Target; index: number; left: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const fly = spring({ frame: frame - 10 - index * 15, fps, config: { damping: 15, stiffness: 110, mass: 0.9 } });
  const fan = (index - 1) * 14;
  const lit = interpolate(frame, [40 + index * 15, 50 + index * 15], [0, 1], CLAMP);

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: ROW_TOP,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 24,
        padding: 30,
        background: 'linear-gradient(160deg, rgba(40,38,70,0.9), rgba(18,17,32,0.94))',
        border: `1.5px solid ${lit > 0.5 ? `${LAVENDER}aa` : 'rgba(255,255,255,0.12)'}`,
        boxShadow: `0 30px 70px rgba(0,0,0,0.55), 0 0 ${60 * lit}px ${LAVENDER}66`,
        transform: `translateZ(${interpolate(fly, [0, 1], [-2600, 0])}px) rotateY(${-fan * (1 - fly * 0.5)}deg)`,
        opacity: Math.min(1, fly * 2),
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <Glyph kind={target.glyph} />
      <div
        style={{
          fontFamily: OSWALD,
          fontWeight: 700,
          fontSize: 46,
          color: '#fff',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        {t(target.title)}
      </div>
      <div style={{ fontFamily: OSWALD, fontWeight: 300, fontSize: 25, color: '#c9cbe0' }}>{t(target.sub)}</div>
      <div style={{ marginTop: 'auto', fontFamily: MONO, fontSize: 20, color: YELLOW }}>▸ {t(target.code)}</div>
    </div>
  );
};

const Glyph = ({ kind }: { kind: Target['glyph'] }) => {
  const stroke = {
    fill: 'none',
    stroke: PINK,
    strokeWidth: 4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      {kind === 'terminal' && (
        <>
          <rect x="4" y="8" width="48" height="40" rx="8" {...stroke} />
          <path d="M14 22 L22 28 L14 34 M26 36 H40" {...stroke} />
        </>
      )}
      {kind === 'browser' && (
        <>
          <rect x="4" y="8" width="48" height="40" rx="8" {...stroke} />
          <path d="M4 18 H52" {...stroke} />
          <circle cx="12" cy="13" r="1.5" fill={PINK} />
          <circle cx="18" cy="13" r="1.5" fill={PINK} />
        </>
      )}
      {kind === 'phone' && (
        <>
          <rect x="16" y="4" width="24" height="48" rx="7" {...stroke} />
          <path d="M25 45 H31" {...stroke} />
        </>
      )}
    </svg>
  );
};

/** Slow star drift, so the deep-space fly-in has a sense of distance. */
const Starfield = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {Array.from({ length: 70 }, (_, index) => {
        const seedX = (Math.sin(index * 91.7) + 1) / 2;
        const seedY = (Math.cos(index * 47.3) + 1) / 2;
        const z = ((index * 37) % 10) / 10;
        const x = ((seedX * 1920 - 960) * (1 + frame * 0.004 * (1 + z)) + 960) % 1920;
        const y = (seedY * 1080 - 540) * (1 + frame * 0.004 * (1 + z)) + 540;

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 2 + z * 2,
              height: 2 + z * 2,
              borderRadius: 9,
              background: '#fff',
              opacity: 0.25 + z * 0.4,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
