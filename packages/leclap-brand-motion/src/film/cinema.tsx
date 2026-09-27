import { type CSSProperties, type ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, PINK, YELLOW } from '../brand';
import { OSWALD } from '../fonts';

// The film layer: everything that makes the showcase read as cinema rather than a slideshow — letterbox,
// grain, vignette, flashes on impacts, anamorphic flares, spark bursts, light sweeps, and the scene
// shell that punches each shot in and throws it out on an action (a zoom-through, a whip, a fall).

export const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Named cubic-béziers — the curves the scenes reach for (gravity falls, settles, swings). */
export const EASE = {
  inQuad: Easing.bezier(0.55, 0.085, 0.68, 0.53),
  outCubic: Easing.bezier(0.33, 1, 0.68, 1),
  inOutCubic: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

/** The Kinetic Editorial ease-out-expo, as a function. */
export const easeOutExpo = (x: number): number => (x >= 1 ? 1 : 1 - 2 ** (-10 * x));

// Gradient text. `backgroundImage` rather than the `background` shorthand, which would reset
// background-clip whenever React re-sets it and paint the gradient as a box.
export const BRAND_TEXT: CSSProperties = {
  backgroundImage: `linear-gradient(100deg, ${LAVENDER}, ${PINK})`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  paddingBottom: '0.08em',
};

// ─── global overlays ────────────────────────────────────────────────────────────────────────────

/** Cinema bars. `amount` 0..1 of the resting height; >1 closes the frame (the end iris). */
export const Letterbox = ({ amount }: { amount: number }) => {
  const { height } = useVideoConfig();
  const bar = height * 0.065 * amount;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: bar, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: bar, background: '#000' }} />
    </AbsoluteFill>
  );
};

/** Animated film grain: a fresh turbulence seed every other frame, rendered small and scaled up. */
export const Grain = ({ opacity = 0.09 }: { opacity?: number }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 24;

  return (
    <AbsoluteFill style={{ mixBlendMode: 'overlay', opacity, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" viewBox="0 0 640 360" preserveAspectRatio="none">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="640" height="360" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette = ({ strength = 0.6 }: { strength?: number }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

/** A white (or tinted) flash that peaks on `at` (frame) and decays over `length` frames. */
export const Flash = ({
  at,
  length = 10,
  color = '#fff',
  peak = 0.85,
}: {
  at: number;
  length?: number;
  color?: string;
  peak?: number;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [at - 1, at, at + length], [0, peak, 0], CLAMP);

  if (opacity <= 0) return null;

  return <AbsoluteFill style={{ background: color, opacity, mixBlendMode: 'screen', pointerEvents: 'none' }} />;
};

/** Brand-tinted glows drifting behind a scene so dark grounds never read flat. */
export const DriftGlow = ({
  hueA = LAVENDER,
  hueB = PINK,
  intensity = 1,
}: {
  hueA?: string;
  hueB?: string;
  intensity?: number;
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [0.3, 0.7]);
  const alpha = (value: number) =>
    Math.round(value * intensity)
      .toString(16)
      .padStart(2, '0');

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(900px 600px at ${x * 100}% 30%, ${hueA}${alpha(60)}, transparent 70%),
          radial-gradient(900px 600px at ${(1 - x) * 100}% 95%, ${hueB}${alpha(48)}, transparent 70%)`,
      }}
    />
  );
};

// ─── light ──────────────────────────────────────────────────────────────────────────────────────

/** A horizontal anamorphic lens streak with a hot core, blooming on `at` (frame). */
export const AnamorphicFlare = ({
  at,
  y = 0.5,
  color = LAVENDER,
  length = 40,
}: {
  at: number;
  y?: number;
  color?: string;
  length?: number;
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame - at;

  if (t < 0 || t > length) return null;

  const grow = easeOutExpo(t / 10);
  const fade = interpolate(t, [0, 6, length], [0, 1, 0], CLAMP);

  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none', opacity: fade }}>
      <div
        style={{
          position: 'absolute',
          top: height * y - 3,
          left: width * (0.5 - grow * 0.6),
          width: width * grow * 1.2,
          height: 6,
          borderRadius: 999,
          background: `linear-gradient(90deg, transparent, ${color}, #fff, ${color}, transparent)`,
          filter: 'blur(2px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: height * y - 60,
          left: width * 0.5 - 60,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, #fff, ${color}88 35%, transparent 70%)`,
          transform: `scale(${1 + grow})`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * A radial burst of brand-coloured sparks thrown out on `at` (frame), falling with gravity. `x`/`y` are
 * fractions of the box it sits in — the whole frame by default; pass `box` when it lives in a smaller one.
 */
export const Sparks = ({
  at,
  count = 36,
  x = 0.5,
  y = 0.5,
  spread = 520,
  seed = 'sparks',
  box,
}: {
  at: number;
  count?: number;
  x?: number;
  y?: number;
  spread?: number;
  seed?: string;
  box?: { width: number; height: number };
}) => {
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  const { width, height } = box ?? video;
  const t = frame - at;

  if (t < 0 || t > 50) return null;

  const colors = [LAVENDER, PINK, YELLOW, '#fff'];

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      {Array.from({ length: count }, (_, index) => {
        const angle = random(`${seed}-a-${index}`) * Math.PI * 2;
        const speed = 0.35 + random(`${seed}-s-${index}`) * 0.65;
        const travel = easeOutExpo(t / 30) * spread * speed;
        const px = width * x + Math.cos(angle) * travel;
        const py = height * y + Math.sin(angle) * travel + t * t * 0.12;
        const size = 4 + random(`${seed}-z-${index}`) * 8;
        const life = interpolate(t, [0, 8, 50], [0, 1, 0], CLAMP);

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: size * (1 + speed * 2),
              height: size * 0.5,
              borderRadius: 999,
              background: colors[index % colors.length],
              opacity: life,
              transform: `rotate(${(angle * 180) / Math.PI}deg)`,
              boxShadow: `0 0 12px ${colors[index % colors.length]}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** An expanding shockwave ring on `at` (frame). */
export const Shockwave = ({
  at,
  x = 0.5,
  y = 0.5,
  color = PINK,
}: {
  at: number;
  x?: number;
  y?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame - at;

  if (t < 0 || t > 28) return null;

  const r = easeOutExpo(t / 22) * width * 0.6;

  return (
    <div
      style={{
        position: 'absolute',
        left: width * x - r,
        top: height * y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        border: `${interpolate(t, [0, 28], [14, 1])}px solid ${color}`,
        opacity: interpolate(t, [0, 28], [0.9, 0], CLAMP),
        boxShadow: `0 0 40px ${color}`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─── type ───────────────────────────────────────────────────────────────────────────────────────

/** Trailer title: tracking collapses from wide to tight while the line fades up out of blur. */
export const TrackingTitle = ({
  text,
  start,
  size,
  color = '#fff',
  gradient = false,
  weight = 700,
  style,
}: {
  text: string;
  start: number;
  size: number;
  color?: string;
  gradient?: boolean;
  weight?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const x = easeOutExpo(interpolate(frame, [start, start + 26], [0, 1], CLAMP));

  return (
    <div
      style={{
        fontFamily: OSWALD,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.05,
        textTransform: 'uppercase',
        letterSpacing: `${interpolate(x, [0, 1], [0.6, 0.04])}em`,
        opacity: x,
        filter: `blur(${interpolate(x, [0, 1], [14, 0])}px)`,
        whiteSpace: 'nowrap',
        ...(gradient ? BRAND_TEXT : { color }),
        ...style,
      }}
    >
      {text}
    </div>
  );
};

/** Kinetic Editorial heading: each word rises in on a staggered spring. */
const hexRgb = (hex: string): readonly [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

/** The colour `t` (0–1) of the way along the brand gradient, lavender → pink. */
const brandAt = (t: number): string => {
  const from = hexRgb(LAVENDER);
  const to = hexRgb(PINK);
  const [r, g, b] = from.map((channel, index) => Math.round(channel + (to[index] - channel) * t));

  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Each gradient word's slice of the brand gradient, `[from, to]` in 0–1, keyed by word index.
 * Consecutive gradient words share one sweep, sliced by characters (spaces included), so "VIDÉO FINIE"
 * reads as one gradient rather than two words each running lavender → pink.
 */
const gradientSlices = (
  words: readonly string[],
  gradientWords: readonly string[]
): Map<number, readonly [number, number]> => {
  const slices = new Map<number, readonly [number, number]>();
  let first = 0;

  while (first < words.length) {
    if (!gradientWords.includes(words[first])) {
      first += 1;
      continue;
    }

    let last = first;

    while (last + 1 < words.length && gradientWords.includes(words[last + 1])) last += 1;

    const total = words.slice(first, last + 1).join(' ').length;
    let offset = 0;

    for (let index = first; index <= last; index += 1) {
      const from = offset / total;
      offset += words[index].length;
      slices.set(index, [from, offset / total]);
      offset += 1;
    }

    first = last + 1;
  }

  return slices;
};

export const KineticWords = ({
  text,
  start,
  size,
  stagger = 3,
  gradientWords = [],
  color = '#fff',
  align = 'center',
}: {
  text: string;
  start: number;
  size: number;
  stagger?: number;
  gradientWords?: readonly string[];
  color?: string;
  align?: 'center' | 'left';
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  const slices = gradientSlices(words, gradientWords);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        columnGap: '0.24em',
        fontFamily: OSWALD,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        textTransform: 'uppercase',
      }}
    >
      {words.map((word, index) => {
        const enter = spring({
          frame: frame - start - index * stagger,
          fps,
          config: { damping: 14, stiffness: 180, mass: 0.6 },
        });
        const slice = slices.get(index);

        return (
          <span
            key={`${word}-${index}`}
            style={{
              display: 'inline-block',
              opacity: Math.min(1, enter * 1.4),
              transform: `translateY(${interpolate(enter, [0, 1], [0.6, 0]) * size}px) scale(${interpolate(enter, [0, 1], [0.8, 1])})`,
              ...(slice
                ? {
                    ...BRAND_TEXT,
                    backgroundImage: `linear-gradient(100deg, ${brandAt(slice[0])}, ${brandAt(slice[1])})`,
                  }
                : { color }),
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/** The Kinetic Editorial kicker chip: gradient pill, tracked caps. */
export const Kicker = ({ children, appear = 1 }: { children: ReactNode; appear?: number }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      fontFamily: OSWALD,
      fontSize: 24,
      fontWeight: 600,
      letterSpacing: 6,
      color: '#fff',
      padding: '8px 22px',
      borderRadius: 999,
      background: `linear-gradient(135deg, ${LAVENDER}, ${PINK})`,
      opacity: appear,
      transform: `translateY(${(1 - appear) * 16}px)`,
      boxShadow: `0 10px 30px ${LAVENDER}55`,
    }}
  >
    {children}
  </div>
);

// ─── scene shell ────────────────────────────────────────────────────────────────────────────────

export type SceneExit = 'none' | 'zoom' | 'whip' | 'fall' | 'fade' | 'crt';
export type SceneEnter = 'none' | 'punch' | 'whip' | 'fade';

/**
 * Wraps a scene in its entrance and its exit. Every exit is an action — a zoom-through toward a point,
 * a whip pan, a fall out of frame — so no cut arrives unmotivated.
 */
export const SceneShell = ({
  children,
  enter = 'punch',
  exit = 'none',
  exitOrigin = '50% 50%',
  exitFrames = 10,
}: {
  children: ReactNode;
  enter?: SceneEnter;
  exit?: SceneExit;
  exitOrigin?: string;
  exitFrames?: number;
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const inX = easeOutExpo(interpolate(frame, [0, 12], [0, 1], CLAMP));
  const outX = interpolate(frame, [durationInFrames - exitFrames, durationInFrames], [0, 1], CLAMP);
  const outEase = outX ** 2.2;

  const enterStyle = (): CSSProperties => {
    if (enter === 'punch') {
      return { transform: `scale(${interpolate(inX, [0, 1], [1.18, 1])})`, filter: `blur(${(1 - inX) * 14}px)` };
    }

    if (enter === 'whip') {
      return { transform: `translateX(${(1 - inX) * width * 0.4}px)`, filter: `blur(${(1 - inX) * 30}px)` };
    }

    if (enter === 'fade') return { opacity: inX };

    return {};
  };

  const exitStyle = (): CSSProperties => {
    if (exit === 'zoom') {
      return { transform: `scale(${1 + outEase * 5})`, filter: `blur(${outEase * 18}px)`, opacity: 1 - outX ** 4 };
    }

    if (exit === 'whip') {
      return { transform: `translateX(${-outEase * width * 0.5}px)`, filter: `blur(${outEase * 40}px)` };
    }

    if (exit === 'fall') return { transform: `translateY(${outEase * 900}px) rotate(${outEase * 8}deg)` };

    if (exit === 'fade') return { opacity: 1 - outX };

    // An old monitor switching off: the picture collapses to a hot line, then to a point.
    if (exit === 'crt') {
      return {
        transform: `scale(${1 - interpolate(outX, [0.6, 1], [0, 1], CLAMP)}, ${Math.max(0.003, 1 - interpolate(outX, [0, 0.6], [0, 1], CLAMP))})`,
        filter: `brightness(${1 + outX * 3})`,
      };
    }

    return {};
  };

  return (
    <AbsoluteFill style={{ ...enterStyle() }}>
      <AbsoluteFill style={{ ...exitStyle(), transformOrigin: exitOrigin }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── motion-design extras ───────────────────────────────────────────────────────────────────────

/**
 * A line of type fading up into place: opacity in, a short rise and a defocus that clears. Whole letters
 * on every frame — a mask-edge reveal slices them in half mid-move, which reads as a glitch when paused.
 */
export const FadeReveal = ({
  text,
  start,
  size,
  color = '#fff',
  gradient = false,
  tracking = 0.02,
  weight = 700,
}: {
  text: string;
  start: number;
  size: number;
  color?: string;
  gradient?: boolean;
  tracking?: number;
  weight?: number;
}) => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [start, start + 14], [0, 1], { ...CLAMP, easing: EASE.outCubic });
  const settle = easeOutExpo(interpolate(frame, [start, start + 22], [0, 1], CLAMP));

  return (
    <div style={{ paddingBottom: '0.08em', lineHeight: 1.05 }}>
      <div
        style={{
          fontFamily: OSWALD,
          fontWeight: weight,
          fontSize: size,
          textTransform: 'uppercase',
          letterSpacing: `${tracking}em`,
          whiteSpace: 'nowrap',
          opacity: fade,
          transform: `translateY(${(1 - settle) * 0.3 * size}px)`,
          filter: `blur(${(1 - settle) * 12}px)`,
          ...(gradient ? BRAND_TEXT : { color }),
        }}
      >
        {text}
      </div>
    </div>
  );
};

/**
 * A program monitor waiting for its template: a slow scan sweeping the dark glass and a "waiting" line
 * with ticking dots — a standby that reads as alive rather than a dead black frame.
 */
export const MonitorStandby = ({ label, size = 28 }: { label: string; size?: number }) => {
  const frame = useCurrentFrame();
  const scan = (frame % 54) / 54;
  const dots = '.'.repeat(Math.floor(frame / 7) % 4);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${scan * 120 - 10}%`,
          height: '18%',
          background: `linear-gradient(180deg, transparent, ${LAVENDER}22, transparent)`,
        }}
      />
      <div style={{ fontFamily: OSWALD, fontSize: size, letterSpacing: 8, color: '#5c5e7a', whiteSpace: 'nowrap' }}>
        {label}
        <span style={{ display: 'inline-block', width: '1.4em', textAlign: 'left' }}>{dots}</span>
      </div>
    </AbsoluteFill>
  );
};

const WARP_COLORS = [PINK, LAVENDER, '#fff'] as const;

/** Hyperspace streaks radiating from the centre — sells a dive through the screen. */
export const WarpLines = ({ from, to, count = 90 }: { from: number; to: number; count?: number }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  if (frame < from || frame > to) return null;

  const x = (frame - from) / (to - from);
  const intensity = interpolate(x, [0, 0.3, 1], [0, 1, 1], CLAMP);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      <svg width={width} height={height}>
        {Array.from({ length: count }, (_, index) => {
          const angle = random(`warp-a-${index}`) * Math.PI * 2;
          const speed = 0.5 + random(`warp-s-${index}`);
          const r0 = ((random(`warp-r-${index}`) + x * speed * 1.6) % 1) * width * 0.75;
          const len = 40 + x * 420 * speed;
          const cx = width / 2;
          const cy = height / 2;

          return (
            <line
              key={index}
              x1={cx + Math.cos(angle) * r0}
              y1={cy + Math.sin(angle) * r0}
              x2={cx + Math.cos(angle) * (r0 + len)}
              y2={cy + Math.sin(angle) * (r0 + len)}
              stroke={WARP_COLORS[index % WARP_COLORS.length]}
              strokeWidth={1.5 + speed * 2}
              strokeLinecap="round"
              opacity={intensity * (0.35 + random(`warp-o-${index}`) * 0.6)}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Decaying impact pulses: 1 on the hit frame, easing to 0 over `length` frames. */
export const impactAt = (frame: number, hits: readonly number[], length = 16): number =>
  hits.reduce((max, hit) => Math.max(max, interpolate(frame - hit, [0, 1, length], [0, 1, 0], CLAMP)), 0);

/**
 * Camera shake + RGB split on impacts, applied to everything beneath it (the scenes, not the
 * letterbox). The shake is a sum of incommensurate sines, so it never loops visibly.
 */
export const ImpactCamera = ({
  children,
  hits,
}: {
  children: ReactNode;
  hits: readonly { frame: number; strength: number }[];
}) => {
  const frame = useCurrentFrame();
  const amount = hits.reduce((max, hit) => Math.max(max, impactAt(frame, [hit.frame], 18) * hit.strength), 0);
  const x = (Math.sin(frame * 1.91) + Math.sin(frame * 3.37) * 0.6) * 18 * amount;
  const y = (Math.cos(frame * 2.53) + Math.sin(frame * 4.11) * 0.5) * 14 * amount;
  const rot = Math.sin(frame * 2.17) * 0.8 * amount;
  const split = Math.round(amount * 14);

  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id={`rgb-split-${split}`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="r"
          />
          <feOffset in="r" dx={split} dy={0} result="r2" />
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="g"
          />
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="b"
          />
          <feOffset in="b" dx={-split} dy={0} result="b2" />
          <feBlend in="r2" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b2" mode="screen" />
        </filter>
      </svg>
      <AbsoluteFill
        style={{
          transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${1 + amount * 0.03})`,
          filter: split >= 2 ? `url(#rgb-split-${split})` : undefined,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
