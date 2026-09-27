import { useId } from 'react';
import { useCurrentFrame } from 'remotion';

// Clappy — the films' one recurring character: the LeClap logo mark (favicon.svg / the PWA icon),
// redrawn by hand and gently chubby, then given a face and a body. Its design is fixed; only the pose
// and expression change. When it slams shut, the edit cuts.
//   • the logo's geometry and colours: the wide rounded board with its pink gradient, the thick purple
//     outline, pale-yellow/periwinkle sticks at -26°, the hinge block with its cream dot — only puffed
//     a little (the sides bow out and the bottom rounds off)
//   • a face on the board (big eyes with two highlights, hatched blush, a tiny mouth), chubby arms and
//     little feet, kept small so the silhouette stays the logo's
//   • hand-drawn rendering: ink lines that boil (the displacement noise re-seeds at 10 fps, like
//     redrawn animation frames), fills coloured slightly off-register, crayon grain, hatched shading
//   • `badge`: the logo's lavender→pink disc and gold ring behind it — Clappy as the app icon
// The choreography helpers (useClap, useHop, useLook, useBlink, ClapBody) live in acting.tsx.

const OUTLINE = '#5E51AC';
const PUPIL = '#2a1f55';
const BOARD_TOP = '#FFA0B7';
const BOARD_BOTTOM = '#EE6184';
const STRIPE_YELLOW = '#FEF0A6';
const STRIPE_PERI = '#8C80D8';
const DOT = '#FFF6D0';
const CHEEK = '#FF6F97';
const HINGE = '140 250';

export type ClappyMood = 'smile' | 'grin' | 'wow' | 'wink' | 'focused' | 'proud' | 'love' | 'sleepy';

export interface ClappyPose {
  /** Top-stick angle in degrees; 0 = shut, -25 = the logo's resting open angle. */
  angle?: number;
  /** Where the pupils look, each -1..1. */
  lookX?: number;
  lookY?: number;
  /** 0 = open eyes, 1 = shut. */
  blink?: number;
  mood?: ClappyMood;
  /** Arm angles in degrees from hanging straight down, swinging outward (90 = level, 150 = raised). */
  armL?: number;
  armR?: number;
  /**
   * Run-cycle phase in turns (repeats every 1): the feet trade places, one lifting and stepping ahead while
   * the other pushes off. Unset, Clappy stands.
   */
  stride?: number;
  /** Line-boil intensity (displacement scale). */
  boil?: number;
  /** Draw the logo's disc and gold ring behind it, limbs hidden (the app-icon pose). */
  badge?: boolean;
  /** The soft drop shadow that lifts it off the films' dark ground. */
  shadow?: boolean;
}

// The logo's board (x 96–504, y 302–496), puffed: the sides bow out a touch toward a rounder bottom.
const BOARD =
  'M136 302 L464 302 C488 302 504 318 506 342 L511 452 C513 488 490 510 454 511 L146 511 C110 510 87 488 89 452 L94 342 C96 318 112 302 136 302 Z';

// The character's frame in the mark's 600 space (the same crop the films were laid out with), and the
// badge pose: the whole icon, the character placed in the disc exactly like the clapper in favicon.svg.
const FRAME = '60 150 480 380';
const BADGE_FRAME = 'translate(300 300) scale(0.68) translate(-298 -310)';

export const Clappy = ({ size, boil = 5, badge = false, shadow = true, ...pose }: ClappyPose & { size: number }) => {
  const frame = useCurrentFrame();
  const id = useId().replace(/:/g, '');
  const seed = Math.floor(frame / 3) % 6;

  return (
    <svg width={size} height={size} viewBox={badge ? '0 0 600 600' : FRAME} style={{ overflow: 'visible' }}>
      <Defs id={id} seed={seed} boil={boil} />
      <g filter={shadow && !badge ? `url(#${id}-shadow)` : undefined}>
        <g filter={`url(#${id}-boil)`}>
          {badge && <Badge id={id} />}
          <g transform={badge ? BADGE_FRAME : undefined}>
            <Character id={id} limbs={!badge} {...pose} />
          </g>
        </g>
      </g>
    </svg>
  );
};

const Defs = ({ id, seed, boil }: { id: string; seed: number; boil: number }) => (
  <defs>
    <filter id={`${id}-boil`} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed={seed} result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={boil * 1.3} xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="190%">
      <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#0B0820" floodOpacity="0.55" />
    </filter>
    <filter id={`${id}-grain`}>
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed={seed + 3} />
      <feColorMatrix values="0 0 0 0 0.37  0 0 0 0 0.32  0 0 0 0 0.67  0 0 0 0.5 0" />
    </filter>
    <linearGradient id={`${id}-board`} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor={BOARD_TOP} />
      <stop offset="1" stopColor={BOARD_BOTTOM} />
    </linearGradient>
    <linearGradient id={`${id}-disc`} x1="0.18" y1="0.15" x2="0.82" y2="0.85">
      <stop stopColor="#C3C7FF" />
      <stop offset="1" stopColor="#FFCFDE" />
    </linearGradient>
    <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor="#FFF0A0" />
      <stop offset="0.55" stopColor="#FFE45E" />
      <stop offset="1" stopColor="#EFC23C" />
    </linearGradient>
    <radialGradient id={`${id}-sheen`} cx="0.5" cy="0.14" r="0.64">
      <stop stopColor="#fff" stopOpacity="0.34" />
      <stop offset="1" stopColor="#fff" stopOpacity="0" />
    </radialGradient>
    <clipPath id={`${id}-clip`}>
      <path d={BOARD} />
    </clipPath>
    <pattern id={`${id}-stripes`} width="96" height="96" patternUnits="userSpaceOnUse" patternTransform="rotate(-26)">
      <rect width="96" height="96" fill={STRIPE_YELLOW} />
      <rect x="48" width="48" height="96" fill={STRIPE_PERI} />
    </pattern>
  </defs>
);

/** The posed character: limbs behind, then the logo's board, sticks and hinge block, then the face. */
const Character = ({
  id,
  limbs,
  angle = -25,
  lookX = 0,
  lookY = 0,
  blink = 0,
  mood = 'smile',
  armL = 50,
  armR = 50,
  stride,
}: Omit<ClappyPose, 'boil' | 'badge' | 'shadow'> & { id: string; limbs: boolean }) => (
  <>
    {limbs && <Limbs id={id} armL={armL} armR={armR} stride={stride} />}

    {/* the board: gradient fill a touch off-register, crayon grain, hatched shade, then the ink */}
    <path d={BOARD} fill={`url(#${id}-board)`} transform="translate(6 5)" />
    <g clipPath={`url(#${id}-clip)`}>
      <rect
        x="80"
        y="290"
        width="440"
        height="232"
        filter={`url(#${id}-grain)`}
        opacity="0.3"
        style={{ mixBlendMode: 'multiply' }}
      />
      {[0, 1, 2, 3, 4].map((index) => (
        <path
          key={index}
          d={`M${436 + index * 13} ${494 - index * 6} L${456 + index * 13} ${466 - index * 6}`}
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.32}
        />
      ))}
    </g>
    <path d={BOARD} fill="none" stroke={OUTLINE} strokeWidth={22} strokeLinejoin="round" />

    {/* the sticks and the hinge block, as in the logo */}
    <Stick id={id} y={252} />
    <g transform={`rotate(${angle} ${HINGE})`}>
      <Stick id={id} y={192} />
    </g>
    <rect x="95" y="221" width="80" height="96" rx="24" fill={`url(#${id}-board)`} />
    <rect
      x="90"
      y="216"
      width="80"
      height="96"
      rx="24"
      fill="none"
      stroke={OUTLINE}
      strokeWidth={22}
      strokeLinejoin="round"
    />
    <circle cx="130" cy="264" r="17" fill={DOT} stroke={OUTLINE} strokeWidth={7} />

    <Face lookX={lookX} lookY={lookY} eye={Math.max(0.1, 1 - blink)} mood={mood} />
  </>
);

/** One clapper stick: striped fill off-register, then the ink. */
const Stick = ({ id, y }: { id: string; y: number }) => (
  <>
    <rect x="137" y={y + 5} width="372" height="58" rx="18" fill={`url(#${id}-stripes)`} />
    <rect
      x="132"
      y={y}
      width="372"
      height="58"
      rx="18"
      fill="none"
      stroke={OUTLINE}
      strokeWidth={22}
      strokeLinejoin="round"
    />
  </>
);

/** The logo's disc, gold ring and sheen. */
const Badge = ({ id }: { id: string }) => (
  <>
    <circle cx="300" cy="300" r="278" fill={`url(#${id}-disc)`} stroke={`url(#${id}-ring)`} strokeWidth={28} />
    <circle cx="300" cy="300" r="264" fill={`url(#${id}-sheen)`} />
  </>
);

// Shoulders sit just inside the board's sides, a little above its middle.
const SHOULDER_Y = 344;

// A chubby arm hanging from its shoulder at the origin: slim where it joins the board, swelling into a
// round mitten at the end, so a raised arm reads as a hand rather than an ear.
const ARM = 'M-17 -4 C-19 26 -30 46 -29 68 C-28 88 -14 100 0 100 C14 100 28 88 29 68 C30 46 19 26 17 -4 Z';

/**
 * Chubby arms and two little feet, drawn behind the board. Each arm hangs from its shoulder pivot and
 * swings outward from there, so it stays attached however far it swings, and a raised arm clears the
 * board's corner. With a `stride`, the feet run: half a turn apart, each lifts in an arc and lands ahead.
 */
const Limbs = ({ id, armL, armR, stride }: { id: string; armL: number; armR: number; stride?: number }) => {
  const left = footStep(stride);
  const right = footStep(stride === undefined ? undefined : stride + 0.5);

  return (
    <>
      <Blob cx={222 + left.dx} cy={524 + left.dy} rx={44} ry={22} fill={BOARD_BOTTOM} />
      <Blob cx={378 + right.dx} cy={524 + right.dy} rx={44} ry={22} fill={BOARD_BOTTOM} />
      <Arm id={id} x={98} angle={armL} />
      <Arm id={id} x={502} angle={-armR} />
    </>
  );
};

/** One foot's offset at a run-cycle phase: lifted through the first half-turn, planted through the second. */
const footStep = (phase: number | undefined): { dx: number; dy: number } => {
  if (phase === undefined) return { dx: 0, dy: 0 };

  const turn = phase * Math.PI * 2;

  return { dx: Math.cos(turn) * -16, dy: -Math.max(0, Math.sin(turn)) * 34 };
};

const Arm = ({ id, x, angle }: { id: string; x: number; angle: number }) => (
  <g transform={`translate(${x} ${SHOULDER_Y}) rotate(${angle})`}>
    <path d={ARM} fill={`url(#${id}-board)`} transform="translate(4 4)" />
    <path d={ARM} fill="none" stroke={OUTLINE} strokeWidth={13} strokeLinejoin="round" />
  </g>
);

/** A hand-inked blob: off-register fill, then the ink line. */
const Blob = ({ cx, cy, rx, ry, fill }: { cx: number; cy: number; rx: number; ry: number; fill: string }) => (
  <>
    <ellipse cx={cx + 4} cy={cy + 4} rx={rx} ry={ry} fill={fill} />
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={OUTLINE} strokeWidth={13} />
  </>
);

type EyeShape = 'open' | 'shut' | 'happy' | 'heart';

/** Each eye's shape for a mood (left, right). */
const eyeShapes = (mood: ClappyMood): readonly [EyeShape, EyeShape] => {
  if (mood === 'love') return ['heart', 'heart'];

  if (mood === 'sleepy') return ['shut', 'shut'];

  if (mood === 'proud') return ['happy', 'happy'];

  if (mood === 'wink') return ['open', 'shut'];

  return ['open', 'open'];
};

const Face = ({ lookX, lookY, eye, mood }: { lookX: number; lookY: number; eye: number; mood: ClappyMood }) => {
  const [left, right] = eyeShapes(mood);
  // Focused narrows the eyes; a blink squashes them shut either way.
  const open = mood === 'focused' ? eye * 0.62 : eye;

  return (
    <g transform={`translate(${lookX * 10} ${lookY * 6})`}>
      <Eye cx={240} cy={396} shape={left} open={open} lookX={lookX} lookY={lookY} />
      <Eye cx={360} cy={396} shape={right} open={open} lookX={lookX} lookY={lookY} />
      <Blush cx={186} cy={444} />
      <Blush cx={414} cy={444} />
      <Mouth mood={mood} />
    </g>
  );
};

const Eye = ({
  cx,
  cy,
  shape,
  open,
  lookX,
  lookY,
}: {
  cx: number;
  cy: number;
  shape: EyeShape;
  open: number;
  lookX: number;
  lookY: number;
}) => {
  if (shape === 'heart') {
    return (
      <path
        d={`M${cx} ${cy + 24} C${cx - 40} ${cy - 2} ${cx - 24} ${cy - 36} ${cx} ${cy - 14} C${cx + 24} ${cy - 36} ${cx + 40} ${cy - 2} ${cx} ${cy + 24} Z`}
        fill={CHEEK}
        stroke={OUTLINE}
        strokeWidth={9}
        strokeLinejoin="round"
      />
    );
  }

  if (shape === 'happy') {
    return (
      <path
        d={`M${cx - 26} ${cy + 10} Q${cx} ${cy - 18} ${cx + 26} ${cy + 10}`}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={10}
        strokeLinecap="round"
      />
    );
  }

  if (shape === 'shut' || open < 0.2) {
    return (
      <path
        d={`M${cx - 26} ${cy + 2} Q${cx} ${cy + 20} ${cx + 26} ${cy + 2}`}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={10}
        strokeLinecap="round"
      />
    );
  }

  return (
    <g transform={`translate(${cx} ${cy}) scale(1 ${open})`}>
      <ellipse rx={33} ry={38} fill="#fff" stroke={OUTLINE} strokeWidth={9} />
      <ellipse cx={lookX * 10} cy={lookY * 11 + 3} rx={22} ry={25} fill={PUPIL} />
      <circle cx={lookX * 10 + 9} cy={lookY * 11 - 8} r={9} fill="#fff" />
      <circle cx={lookX * 10 - 8} cy={lookY * 11 + 13} r={4.5} fill="#fff" />
    </g>
  );
};

/** A crayon blush with three little hatch marks. */
const Blush = ({ cx, cy }: { cx: number; cy: number }) => (
  <g>
    <ellipse cx={cx} cy={cy} rx={27} ry={14} fill={CHEEK} opacity={0.6} />
    {[-11, 0, 11].map((dx) => (
      <path
        key={dx}
        d={`M${cx + dx - 4} ${cy + 7} L${cx + dx + 5} ${cy - 7}`}
        stroke={OUTLINE}
        strokeWidth={3.6}
        strokeLinecap="round"
        opacity={0.5}
      />
    ))}
  </g>
);

const Mouth = ({ mood }: { mood: ClappyMood }) => {
  if (mood === 'wow') return <ellipse cx={300} cy={452} rx={16} ry={19} fill={PUPIL} />;

  if (mood === 'focused') {
    return <path d="M286 452 L314 452" fill="none" stroke={OUTLINE} strokeWidth={9} strokeLinecap="round" />;
  }

  if (mood === 'sleepy') {
    return <path d="M286 452 Q300 461 314 452" fill="none" stroke={OUTLINE} strokeWidth={9} strokeLinecap="round" />;
  }

  if (mood === 'grin' || mood === 'wink' || mood === 'love') {
    return (
      <g>
        <path d="M274 440 Q300 480 326 440 Z" fill={PUPIL} stroke={OUTLINE} strokeWidth={7} strokeLinejoin="round" />
        <path d="M287 458 Q300 471 313 458 Q300 463 287 458 Z" fill={CHEEK} />
      </g>
    );
  }

  return (
    <path
      d="M278 442 Q289 458 300 445 Q311 458 322 442"
      fill="none"
      stroke={OUTLINE}
      strokeWidth={9}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
};
