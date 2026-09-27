import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { LAVENDER, PINK, YELLOW } from '../../brand';
import { OSWALD } from '../../fonts';
import { CLAMP, DriftGlow, KineticWords, MonitorStandby, SceneShell } from '../../film/cinema';
import { ClapBody, useBlink, useClap } from '../../film/acting';
import { Clappy, type ClappyMood } from '../../film/clappy';
import { MONO } from '../../film/devices';
import { useLang, useT } from '../../film/lang';
import { COPY } from '../copy';
import { CLAPS, FPS, sceneById } from '../timeline';

// 10–18s · What LeClap is. A JSON template types itself out on the left; the FFmpeg engine pulls it
// across a particle stream; the finished video lights up in a program monitor on the right. Clappy sits in
// the director's corner, watches the monitor — and claps the cut.

const SLAM = Math.round((CLAPS[1] - sceneById('template').from) * FPS);
const TYPE_FROM = 10;
const TYPE_TO = 118;
const COMPOSE_FROM = 118;
const PLAY_FROM = 150;

type Token = readonly [string, 'key' | 'str' | 'punct'];

// Mirrors the shape of a real descriptor (see examples/agentic-pr-video/template.json).
const CODE: readonly (readonly Token[])[] = [
  [['{', 'punct']],
  [
    ['  "global"', 'key'],
    [': {', 'punct'],
  ],
  [
    ['    "orientation"', 'key'],
    [': ', 'punct'],
    ['"landscape"', 'str'],
    [',', 'punct'],
  ],
  [
    ['    "transition"', 'key'],
    [': { ', 'punct'],
    ['"type"', 'key'],
    [': ', 'punct'],
    ['"fade"', 'str'],
    [' }', 'punct'],
  ],
  [['  },', 'punct']],
  [
    ['  "sections"', 'key'],
    [': [', 'punct'],
  ],
  [
    ['    { ', 'punct'],
    ['"type"', 'key'],
    [': ', 'punct'],
    ['"color_background"', 'str'],
    [',', 'punct'],
  ],
  [
    ['      "titleCard"', 'key'],
    [': { ', 'punct'],
    ['"headline"', 'key'],
    [': ', 'punct'],
    ['"{{ name }}"', 'str'],
    [' } },', 'punct'],
  ],
  [
    ['    { ', 'punct'],
    ['"type"', 'key'],
    [': ', 'punct'],
    ['"project_video"', 'str'],
    [',', 'punct'],
  ],
  [
    ['      "look"', 'key'],
    [': ', 'punct'],
    ['"cool"', 'str'],
    [',', 'punct'],
  ],
  [
    ['      "filters"', 'key'],
    [': [{ ', 'punct'],
    ['"type"', 'key'],
    [': ', 'punct'],
    ['"vignette"', 'str'],
    [' }] }', 'punct'],
  ],
  [['  ]', 'punct']],
  [['}', 'punct']],
];

const COLORS = { key: LAVENDER, str: PINK, punct: '#8a8ca6' } as const;
const TOTAL_CHARS = CODE.reduce((sum, line) => sum + line.reduce((n, [text]) => n + text.length, 0), 0);

export const TemplateScene = () => (
  <SceneShell enter="punch" exit="whip">
    <TemplateBody />
  </SceneShell>
);

const TemplateBody = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = useT();
  const lang = useLang();
  const orbit = interpolate(frame, [0, durationInFrames], [-7, 7]);
  const dolly = interpolate(frame, [0, durationInFrames], [0, 120]);
  const chips = spring({ frame: frame - 160, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ background: '#0b0a14' }}>
      <DriftGlow />

      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 96, gap: 6 }}>
        <KineticWords text={t(COPY.template.in)} start={4} size={78} />
        <KineticWords
          text={t(COPY.template.out)}
          start={COMPOSE_FROM}
          size={78}
          gradientWords={COPY.template.outGradient[lang]}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: '50% 45%' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformStyle: 'preserve-3d',
            transform: `translateZ(${dolly}px) rotateY(${orbit}deg)`,
          }}
        >
          <CodeCard />
          <Stream />
          <Monitor />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 110 }}>
        <div style={{ display: 'flex', gap: 18, opacity: chips, transform: `translateY(${(1 - chips) * 30}px)` }}>
          {COPY.template.chips.map((chip) => (
            <div
              key={chip.en}
              style={{
                fontFamily: OSWALD,
                fontSize: 26,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: '#e8e9ff',
                padding: '10px 24px',
                borderRadius: 999,
                border: `1px solid ${LAVENDER}66`,
                background: 'rgba(124,131,253,0.1)',
              }}
            >
              {t(chip)}
            </div>
          ))}
        </div>
      </AbsoluteFill>

      <Director />
    </AbsoluteFill>
  );
};

const CodeCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, mass: 0.8 } });
  const typed = Math.round(interpolate(frame, [TYPE_FROM, TYPE_TO], [0, TOTAL_CHARS], CLAMP));
  const glow = interpolate(frame, [COMPOSE_FROM - 6, COMPOSE_FROM + 6, COMPOSE_FROM + 30], [0, 1, 0.3], CLAMP);

  // Walk the tokens, revealing `typed` characters in order.
  const lines = CODE.reduce<{ remaining: number; out: { text: string; kind: Token[1] }[][] }>(
    (acc, line) => {
      const out = line.map(([text, kind]) => {
        const shown = text.slice(0, Math.max(0, acc.remaining));
        acc.remaining -= text.length;

        return { text: shown, kind };
      });
      acc.out.push(out);

      return acc;
    },
    { remaining: typed, out: [] }
  ).out;
  const cursorOn = Math.floor(frame / 8) % 2 === 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: 150,
        top: 300,
        width: 760,
        height: 520,
        borderRadius: 20,
        background: 'rgba(16,15,28,0.94)',
        border: `1px solid ${LAVENDER}55`,
        boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 ${80 * glow}px ${LAVENDER}`,
        transform: `rotateY(${interpolate(enter, [0, 1], [50, 18])}deg) translateX(${interpolate(enter, [0, 1], [-400, 0])}px)`,
        opacity: enter,
        padding: '22px 28px',
        fontFamily: MONO,
        fontSize: 21,
        lineHeight: 1.62,
        whiteSpace: 'pre',
      }}
    >
      <div style={{ fontFamily: OSWALD, color: '#8a8ca6', fontSize: 20, letterSpacing: 3, marginBottom: 10 }}>
        TEMPLATE.JSON
      </div>
      {lines.map((line, index) => (
        <div key={index} style={{ minHeight: '1.62em' }}>
          {line.map((token, tokenIndex) => (
            <span key={tokenIndex} style={{ color: COLORS[token.kind] }}>
              {token.text}
            </span>
          ))}
        </div>
      ))}
      <span
        style={{
          position: 'absolute',
          right: 26,
          bottom: 22,
          width: 12,
          height: 26,
          background: YELLOW,
          opacity: cursorOn && frame < TYPE_TO + 20 ? 1 : 0,
        }}
      />
    </div>
  );
};

/** The engine: a particle stream from the code card to the monitor, through a spinning FFmpeg core. */
const Stream = () => {
  const frame = useCurrentFrame();
  const t = frame - COMPOSE_FROM;
  const on = interpolate(t, [0, 8, 60, 90], [0, 1, 1, 0.25], CLAMP);
  const done = t > 40;

  return (
    <div
      style={{
        position: 'absolute',
        left: 900,
        top: 470,
        width: 160,
        height: 160,
        opacity: frame > COMPOSE_FROM - 4 ? 1 : 0,
      }}
    >
      {Array.from({ length: 22 }, (_, index) => {
        const progress = (((t * 0.035 + random(`p${index}`)) % 1) + 1) % 1;
        const x = -20 + progress * 200;
        const y = 80 + Math.sin(progress * Math.PI * 2 + index) * 30 * (1 - progress);

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 10,
              height: 4,
              borderRadius: 9,
              background: index % 2 === 0 ? LAVENDER : PINK,
              boxShadow: `0 0 10px ${index % 2 === 0 ? LAVENDER : PINK}`,
              opacity: on,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 30,
          top: 30,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: done
            ? `conic-gradient(${LAVENDER}, ${PINK}, ${LAVENDER})`
            : `conic-gradient(from ${t * 14}deg, ${LAVENDER}, ${PINK} 40%, transparent 60%)`,
          padding: 6,
          opacity: Math.max(on, done ? 1 : 0),
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: '#12111f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: OSWALD,
            color: '#fff',
            fontSize: done ? 40 : 19,
            letterSpacing: 1,
          }}
        >
          {done ? '✓' : 'FFMPEG'}
        </div>
      </div>
    </div>
  );
};

/** The program monitor: registration brackets, PROGRAM tally, and the gradient playhead. */
const Monitor = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = useT();
  const enter = spring({ frame: frame - 8, fps, config: { damping: 16, mass: 0.8 } });
  const live = frame >= PLAY_FROM;
  const progress = interpolate(frame, [PLAY_FROM, durationInFrames], [0, 1], CLAMP);
  const w = 740;
  const h = (w * 9) / 16;

  return (
    <div
      style={{
        position: 'absolute',
        left: 1060,
        top: 330,
        width: w,
        height: h,
        borderRadius: 22,
        overflow: 'hidden',
        background: '#000',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: live ? `0 40px 90px rgba(0,0,0,0.6), 0 0 90px ${PINK}55` : '0 40px 90px rgba(0,0,0,0.6)',
        transform: `rotateY(${interpolate(enter, [0, 1], [-50, -18])}deg) translateX(${interpolate(enter, [0, 1], [400, 0])}px)`,
        opacity: enter,
      }}
    >
      <Sequence from={PLAY_FROM} layout="none">
        <OffthreadVideo
          src={staticFile('captures/finished-film.mp4')}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Sequence>
      {!live && <MonitorStandby label={t(COPY.template.waiting)} size={30} />}
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <span
          key={corner}
          style={{
            position: 'absolute',
            width: 30,
            height: 30,
            borderColor: 'rgba(255,255,255,0.6)',
            borderStyle: 'solid',
            borderWidth: 0,
            ...(corner.includes('t') ? { top: 16, borderTopWidth: 3 } : { bottom: 16, borderBottomWidth: 3 }),
            ...(corner.includes('l') ? { left: 16, borderLeftWidth: 3 } : { right: 16, borderRightWidth: 3 }),
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 22,
          top: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px',
          borderRadius: 999,
          background: 'rgba(0,0,0,0.6)',
          fontFamily: OSWALD,
          fontSize: 16,
          letterSpacing: 3,
          color: '#fff',
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 9,
            background: live && Math.floor(frame / 10) % 2 === 0 ? '#ff4d6d' : '#55172a',
          }}
        />
        {t(COPY.template.program)}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 22,
          height: 5,
          borderRadius: 9,
          background: 'rgba(255,255,255,0.18)',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            borderRadius: 9,
            background: `linear-gradient(90deg, ${LAVENDER}, ${PINK})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${progress * 100}%`,
            top: -6,
            width: 3,
            height: 17,
            marginLeft: -1,
            background: '#fff',
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};

/** Smiling, then wide-eyed when the monitor lights, then focused for the clap. */
const directorMood = (frame: number): ClappyMood => {
  if (frame > SLAM - 14) return 'focused';

  if (frame > PLAY_FROM) return 'wow';

  return 'smile';
};

/** Clappy in the director's corner: pops up, points at the monitor, gasps when it lights, claps the cut. */
const Director = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 140, fps, config: { damping: 9, stiffness: 150, mass: 0.7 } });
  const point = spring({ frame: frame - 158, fps, config: { damping: 8, stiffness: 180, mass: 0.6 } });
  const { angle, impact } = useClap(SLAM);
  const blink = useBlink(12);
  const windUp = interpolate(frame, [SLAM - 14, SLAM - 5, SLAM, SLAM + 8], [0, 1, 0.3, 0], CLAMP);
  const gasp = interpolate(frame, [PLAY_FROM + 2, PLAY_FROM + 8, PLAY_FROM + 30], [0, 1, 0], CLAMP);
  const mood = directorMood(frame);
  const armL = interpolate(point, [0, 1], [26, 150]) * (1 - windUp) + windUp * 165;
  const armR = 26 + windUp * 139 + Math.sin(frame / 6) * 4;

  return (
    <div style={{ position: 'absolute', right: 120, bottom: 60 }}>
      <ClapBody
        y={interpolate(enter, [0, 1], [340, 0]) - gasp * 22}
        sx={1 + impact * 0.12 + windUp * 0.06}
        sy={1 - impact * 0.14 - windUp * 0.08 + gasp * 0.06}
        rotate={5 - impact * 4}
      >
        <Clappy size={210} angle={angle} lookX={-0.5} lookY={-1} blink={blink} mood={mood} armL={armL} armR={armR} />
      </ClapBody>
    </div>
  );
};
