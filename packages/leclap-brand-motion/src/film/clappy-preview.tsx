import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { OSWALD } from '../fonts';
import { CLAMP, DriftGlow, EASE } from './cinema';
import { ClapBody, useHop } from './acting';
import { Clappy, type ClappyMood, type ClappyPose } from './clappy';

// Clappy's model sheet (film/clappy.tsx): the character acting a 6-second loop on paper — breathe,
// blink, wave, clap, hop, wink — beside the same loop on the films' dark brand ground, every expression,
// and the app icon next to Clappy in the icon's disc. Not used by the films.

export const CLAPPY_PREVIEW = { width: 1920, height: 1080, fps: 30, frames: 180 } as const;

const PAPER = '#FBF6EE';
// The logo's outline purple: Clappy's ink, the title and the action lines.
const INK = '#5E51AC';
const SLAM = 110;

/** The acting loop: the pose at a frame (shared by both stages so they stay in sync). */
const useActing = (): ClappyPose & { sx: number; sy: number; y: number } => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breathe = Math.sin(frame / 9) * 0.025;
  const hop = useHop(128, 90, 13);
  const blink = interpolate(frame, [30, 33, 36, 150, 153, 156], [0, 1, 0, 0, 1, 0], CLAMP);
  const wave = interpolate(frame, [40, 48, 80, 90], [0, 1, 1, 0], { ...CLAMP, easing: EASE.inOutCubic });
  const windUp = interpolate(frame, [SLAM - 14, SLAM - 4], [0, 1], { ...CLAMP, easing: EASE.outCubic });
  const shut = interpolate(frame, [SLAM - 4, SLAM], [0, 1], { ...CLAMP, easing: EASE.inQuad });
  const reopen = spring({ frame: frame - SLAM - 2, fps, config: { damping: 7, stiffness: 210, mass: 0.6 } });
  const impact = interpolate(frame - SLAM, [0, 2, 12], [0, 1, 0], CLAMP);

  const angle = frame < SLAM ? -25 - windUp * 15 + shut * 40 : interpolate(reopen, [0, 1], [0, -25]);
  const armR = 50 + wave * (75 + Math.sin(frame / 2.6) * 20) + windUp * (1 - shut) * 60;
  const armL = 50 + windUp * (1 - shut) * 60;

  return {
    angle,
    blink,
    armL,
    armR,
    lookX: interpolate(frame, [0, 20, 40, 100, 120], [0, 0.6, 0.3, 0.3, 0], CLAMP),
    lookY: -0.1,
    mood: actingMood(frame),
    sx: hop.sx + breathe + impact * 0.1 - windUp * (1 - shut) * 0.04,
    sy: hop.sy - breathe - impact * 0.12 + windUp * (1 - shut) * 0.05,
    y: hop.y,
  };
};

const actingMood = (frame: number): ClappyMood => {
  if (frame > 150 && frame < 172) return 'wink';

  if (frame > SLAM - 2 && frame < SLAM + 10) return 'wow';

  if (frame > 172) return 'love';

  return 'smile';
};

export const ClappyPreview = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    <PaperStage />
    <DarkStage />
  </AbsoluteFill>
);

const PaperStage = () => {
  const pose = useActing();

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 1080, overflow: 'hidden' }}>
      <PaperGrain />
      <div style={{ position: 'absolute', left: 90, top: 70, fontFamily: OSWALD, color: INK }}>
        <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1 }}>Clappy</div>
        <div style={{ fontSize: 32, fontWeight: 300, marginTop: 8, letterSpacing: 2 }}>
          the logo, hand-drawn · chubby
        </div>
      </div>
      <FloorShadow lift={-pose.y} />
      <div style={{ position: 'absolute', left: 376, top: 360 }}>
        <ClapBody y={pose.y} sx={pose.sx} sy={pose.sy}>
          <Clappy size={528} shadow={false} {...pose} />
        </ClapBody>
      </div>
      <ActionLines x={640} y={540} />
    </div>
  );
};

/** The contact shadow on the paper floor: it stays on the ground, shrinking and fading as Clappy hops. */
const FloorShadow = ({ lift }: { lift: number }) => {
  const away = Math.min(1, lift / 120);

  return (
    <div
      style={{
        position: 'absolute',
        left: 640 - 202,
        top: 862 - 18,
        width: 404,
        height: 36,
        borderRadius: '50%',
        background: INK,
        opacity: 0.16 * (1 - away * 0.6),
        transform: `scale(${1 - away * 0.3})`,
      }}
    />
  );
};

/** Hand-drawn impact strokes around the clapper when it slams. */
const ActionLines = ({ x, y }: { x: number; y: number }) => {
  const frame = useCurrentFrame();
  const t = frame - SLAM;

  if (t < 0 || t > 12) return null;

  const grow = EASE.outCubic(t / 8);
  const fade = interpolate(t, [0, 3, 12], [0, 1, 0], CLAMP);

  return (
    <svg width={1280} height={1080} style={{ position: 'absolute', left: 0, top: 0, opacity: fade }}>
      {[-150, -120, -90, -60, -30].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const r0 = 190 + grow * 30;
        const r1 = r0 + 40 + grow * 30;

        return (
          <path
            key={deg}
            d={`M${x + Math.cos(rad) * r0} ${y + Math.sin(rad) * r0} L${x + Math.cos(rad) * r1} ${y + Math.sin(rad) * r1}`}
            stroke={INK}
            strokeWidth={8}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

/** Paper tooth: a faint, slowly re-seeded fibre noise. */
const PaperGrain = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 3) % 4;

  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.35, mixBlendMode: 'multiply' }}>
      <filter id={`paper-${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed={seed} />
        <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.3  0 0 0 0.25 0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#paper-${seed})`} />
    </svg>
  );
};

const EXPRESSIONS: readonly ClappyMood[] = ['smile', 'grin', 'wow', 'wink', 'focused', 'proud', 'love', 'sleepy'];

const DarkStage = () => {
  const pose = useActing();

  return (
    <div
      style={{
        position: 'absolute',
        left: 1280,
        top: 0,
        width: 640,
        height: 1080,
        overflow: 'hidden',
        background: '#0b0a14',
      }}
    >
      <DriftGlow />
      <Label top={40}>on the films' dark ground</Label>
      <div style={{ position: 'absolute', left: 200, top: 130 }}>
        <ClapBody y={pose.y * 0.45} sx={pose.sx} sy={pose.sy}>
          <Clappy size={240} {...pose} />
        </ClapBody>
      </div>

      <Label top={420}>expressions</Label>
      <div
        style={{
          position: 'absolute',
          left: 40,
          top: 470,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 140px)',
          rowGap: 12,
        }}
      >
        {EXPRESSIONS.map((mood) => (
          <div key={mood} style={{ textAlign: 'center' }}>
            <Clappy size={112} mood={mood} boil={4} />
            <div style={{ fontFamily: OSWALD, fontSize: 20, letterSpacing: 2, color: '#c9cbe0', marginTop: 2 }}>
              {mood}
            </div>
          </div>
        ))}
      </div>

      <Label top={800}>the app icon → Clappy</Label>
      <div style={{ position: 'absolute', left: 70, top: 846 }}>
        <LogoMark size={200} />
      </div>
      <div style={{ position: 'absolute', left: 370, top: 846 }}>
        <Clappy size={200} badge boil={3} />
      </div>
      <div style={{ position: 'absolute', left: 296, top: 920, fontFamily: OSWALD, fontSize: 40, color: '#8a8ca6' }}>
        →
      </div>
    </div>
  );
};

/** The app icon as shipped (apps/leclap-web/public/favicon.svg), for comparison. */
const LogoMark = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 600 600">
    <defs>
      <linearGradient id="logo-disc" x1="110" y1="90" x2="490" y2="510" gradientUnits="userSpaceOnUse">
        <stop stopColor="#C3C7FF" />
        <stop offset="1" stopColor="#FFCFDE" />
      </linearGradient>
      <linearGradient id="logo-ring" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#FFF0A0" />
        <stop offset="0.55" stopColor="#FFE45E" />
        <stop offset="1" stopColor="#EFC23C" />
      </linearGradient>
      <linearGradient id="logo-board" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#FFA0B7" />
        <stop offset="1" stopColor="#EE6184" />
      </linearGradient>
      <radialGradient id="logo-sheen" cx="0.5" cy="0.14" r="0.64">
        <stop stopColor="#fff" stopOpacity="0.34" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <pattern id="logo-stripes" width="96" height="96" patternUnits="userSpaceOnUse" patternTransform="rotate(-26)">
        <rect width="96" height="96" fill="#FEF0A6" />
        <rect x="48" width="48" height="96" fill="#8C80D8" />
      </pattern>
    </defs>
    <circle cx="300" cy="300" r="278" fill="url(#logo-disc)" stroke="url(#logo-ring)" strokeWidth="28" />
    <circle cx="300" cy="300" r="264" fill="url(#logo-sheen)" />
    <g
      transform="translate(300 300) scale(0.68) translate(-298 -304)"
      stroke={INK}
      strokeWidth="24"
      strokeLinejoin="round"
    >
      <rect x="96" y="302" width="408" height="194" rx="40" fill="url(#logo-board)" />
      <rect x="132" y="252" width="372" height="58" rx="18" fill="url(#logo-stripes)" />
      <rect x="132" y="192" width="372" height="58" rx="18" fill="url(#logo-stripes)" transform="rotate(-25 140 250)" />
      <rect x="90" y="216" width="80" height="96" rx="24" fill="url(#logo-board)" />
      <circle cx="130" cy="264" r="17" fill="#FFF6D0" strokeWidth="6" />
    </g>
  </svg>
);

const Label = ({ top, left = 40, children }: { top: number; left?: number; children: string }) => (
  <div
    style={{
      position: 'absolute',
      left,
      top,
      fontFamily: OSWALD,
      fontSize: 22,
      letterSpacing: 4,
      textTransform: 'uppercase',
      color: '#8a8ca6',
    }}
  >
    {children}
  </div>
);
