import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER } from '../brand';
import { OSWALD } from '../fonts';
import { type CSSProperties } from 'react';
import { BRAND_TEXT, CLAMP, EASE } from './cinema';

// The wordmark slam shared by the title and the finale: each letter falls out of the camera a beat
// apart (rotated back in depth, landing flat with an overshoot), then the continuous brand gradient
// pours across the settled word and a specular sweep follows it.

export const SlamWordmark = ({
  text = 'LeClap',
  start = 0,
  size = 290,
}: {
  text?: string;
  start?: number;
  size?: number;
}) => {
  const frame = useCurrentFrame();
  const letters = text.match(/./gu) ?? [];
  const pour = interpolate(frame, [start + 14, start + 30], [0, 1], { ...CLAMP, easing: EASE.inOutCubic });
  const type = { fontFamily: OSWALD, fontWeight: 700, fontSize: size, lineHeight: 1.1, letterSpacing: 2 } as const;

  return (
    <div style={{ position: 'relative', perspective: 900 }}>
      <div style={{ ...type, display: 'flex', opacity: 1 - pour }}>
        {letters.map((letter, index) => (
          <SlamLetter key={`${letter}-${index}`} letter={letter} delay={start + index * 2} />
        ))}
      </div>
      <div
        style={{
          ...type,
          ...BRAND_TEXT,
          position: 'absolute',
          inset: 0,
          clipPath: `inset(0 ${100 - pour * 100}% 0 0)`,
        }}
      >
        {text}
      </div>
      <TextSweep text={text} start={start + 30} type={type} />
    </div>
  );
};

/** A specular band travelling across the word — clipped to the glyphs, so only the letters catch it. */
const TextSweep = ({ text, start, type }: { text: string; start: number; type: CSSProperties }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [start, start + 24], [-30, 130], CLAMP);

  if (frame < start || frame > start + 24) return null;

  return (
    <div
      style={{
        ...type,
        position: 'absolute',
        inset: 0,
        color: 'transparent',
        // backgroundImage, not the `background` shorthand: React re-sets only the changed property each
        // frame, and the shorthand resets background-clip — the band would paint as a bare rectangle.
        backgroundImage: `linear-gradient(105deg, transparent ${x - 14}%, rgba(255,255,255,0.95) ${x}%, transparent ${x + 14}%)`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        paddingBottom: '0.08em',
      }}
    >
      {text}
    </div>
  );
};

const SlamLetter = ({ letter, delay }: { letter: string; delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 11, stiffness: 220, mass: 0.7 } });

  return (
    <span
      style={{
        display: 'inline-block',
        color: '#fff',
        opacity: Math.min(1, s * 3),
        transform: `translateZ(${interpolate(s, [0, 1], [700, 0])}px) rotateX(${interpolate(s, [0, 1], [-75, 0])}deg)`,
        filter: `blur(${Math.max(0, 1 - s) * 16}px)`,
        textShadow: `0 0 40px ${LAVENDER}`,
      }}
    >
      {letter}
    </span>
  );
};
