import { useId } from 'react';
import { cn } from '@/lib/utils';
import { REST_ANGLE, feet, type ClappyMood, type ClappyPose } from './clappy.logic';

// Clappy, the LeClap mascot: the logo mark (public/favicon.svg) redrawn by hand and gently chubby, then given
// a face, arms and little feet. It is the films' character (the private leclap-brand-motion repo:
// src/film/clappy.tsx) drawn the same way, so the app and the films show one Clappy: its design is fixed, only
// the pose and the mood change. Three differences from the films: no line boil (their redrawn-frame wobble
// reads as a glitch at UI sizes), a brand-tinted shadow that sits on light and dark pages alike, and a frame
// that holds the whole character, clapper open. Always decorative: the text beside it says what it means.

const OUTLINE = '#5E51AC';
const PUPIL = '#2a1f55';
const BOARD_TOP = '#FFA0B7';
const BOARD_BOTTOM = '#EE6184';
const STRIPE_YELLOW = '#FEF0A6';
const STRIPE_PERI = '#8C80D8';
const DOT = '#FFF6D0';
const CHEEK = '#FF6F97';
const HINGE = '140 250';

// The logo's board (x 96–504, y 302–496), puffed: the sides bow out a touch toward a rounder bottom.
const BOARD =
  'M136 302 L464 302 C488 302 504 318 506 342 L511 452 C513 488 490 510 454 511 L146 511 C110 510 87 488 89 452 L94 342 C96 318 112 302 136 302 Z';

// The character's frame in the mark's 600 space: the open clapper at the top, the swinging arms at the sides,
// the feet at the bottom. Only a wound-up stick or a flung arm reaches past it.
const VIEW = { x: 0, y: 24, width: 600, height: 536 };

/** Clappy's height for a given width, in px. */
export const clappyHeight = (width: number): number => (width * VIEW.height) / VIEW.width;

export interface ClappyProps extends ClappyPose {
  /** Width in px; the height follows the frame (clappyHeight). */
  size: number;
  /** The soft shadow that lifts it off the page. */
  shadow?: boolean;
  className?: string;
}

export const Clappy = ({ size, shadow = true, className, ...pose }: ClappyProps) => {
  const id = `clappy${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={clappyHeight(size)}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
      className={cn('overflow-visible', className)}
    >
      <Defs id={id} />
      <g filter={shadow ? `url(#${id}-shadow)` : undefined}>
        <Character id={id} {...pose} />
      </g>
    </svg>
  );
};

const Defs = ({ id }: { id: string }) => (
  <defs>
    <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="190%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor={OUTLINE} floodOpacity="0.3" />
    </filter>
    <filter id={`${id}-grain`}>
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="3" />
      <feColorMatrix values="0 0 0 0 0.37  0 0 0 0 0.32  0 0 0 0 0.67  0 0 0 0.5 0" />
    </filter>
    <linearGradient id={`${id}-board`} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor={BOARD_TOP} />
      <stop offset="1" stopColor={BOARD_BOTTOM} />
    </linearGradient>
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
  angle = REST_ANGLE,
  lookX = 0,
  lookY = 0,
  blink = 0,
  mood = 'smile',
  armL = 50,
  armR = 50,
  stride,
}: ClappyPose & { id: string }) => (
  <>
    <Limbs id={id} armL={armL} armR={armR} stride={stride} />

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

// Shoulders sit just inside the board's sides, a little above its middle.
const SHOULDER_Y = 344;

// A chubby arm hanging from its shoulder at the origin: slim where it joins the board, swelling into a
// round mitten at the end, so a raised arm reads as a hand rather than an ear.
const ARM = 'M-17 -4 C-19 26 -30 46 -29 68 C-28 88 -14 100 0 100 C14 100 28 88 29 68 C30 46 19 26 17 -4 Z';

/**
 * Chubby arms and two little feet, drawn behind the board. Each arm hangs from its shoulder pivot and swings
 * outward from there, so it stays attached however far it swings, and a raised arm clears the board's corner.
 * With a `stride`, the feet run (clappy.logic.ts: feet).
 */
const Limbs = ({ id, armL, armR, stride }: { id: string; armL: number; armR: number; stride?: number }) => {
  const [left, right] = feet(stride);

  return (
    <>
      <Blob cx={222 + left.dx} cy={524 + left.dy} rx={44} ry={22} fill={BOARD_BOTTOM} />
      <Blob cx={378 + right.dx} cy={524 + right.dy} rx={44} ry={22} fill={BOARD_BOTTOM} />
      <Arm id={id} x={98} angle={armL} />
      <Arm id={id} x={502} angle={-armR} />
    </>
  );
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
