import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, PINK } from '../../brand';
import { OSWALD } from '../../fonts';
import {
  AnamorphicFlare,
  BRAND_TEXT,
  CLAMP,
  DriftGlow,
  EASE,
  KineticWords,
  FadeReveal,
  Shockwave,
  Sparks,
} from '../../film/cinema';
import { ClapBody, useBlink } from '../../film/acting';
import { Clappy, type ClappyPose } from '../../film/clappy';
import { MONO } from '../../film/devices';
import { useLang, useT } from '../../film/lang';
import { SlamWordmark } from '../../film/wordmark';
import { COPY, TIMING } from '../copy';
import { FPS, HITS, sceneById } from '../timeline';

// 43–50s · The close — the set call: "Lights, camera, merge." ("Silence, on merge." in French). Three
// honest proof points, then the lockup: Clappy drops onto the wordmark, the address, a wink. The letterbox
// closes.

const start = sceneById('outro').from;
const LOGO = Math.round((HITS.logo - start) * FPS);

export const OutroScene = () => {
  const frame = useCurrentFrame();
  const t = useT();
  const lang = useLang();
  const out = interpolate(frame, [LOGO - 10, LOGO], [1, 0], { ...CLAMP, easing: EASE.inOutCubic });

  return (
    <AbsoluteFill style={{ background: '#0b0a14', overflow: 'hidden' }}>
      <DriftGlow intensity={1.3} />
      {out > 0 && (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            opacity: out,
            transform: `scale(${1 + (1 - out) * 0.2})`,
            filter: `blur(${(1 - out) * 10}px)`,
          }}
        >
          <KineticWords
            text={t(COPY.outro.line1)}
            start={TIMING.outroLine1[lang]}
            stagger={TIMING.outroLine1Stagger[lang]}
            size={COPY.outro.size[lang]}
            gradientWords={COPY.outro.line1Gradient[lang]}
          />
          <KineticWords
            text={t(COPY.outro.line2)}
            start={TIMING.outroLine2[lang]}
            size={COPY.outro.size[lang]}
            gradientWords={COPY.outro.line2Gradient[lang]}
          />
          <div style={{ display: 'flex', gap: 18, marginTop: 44 }}>
            {COPY.outro.proofs.map((proof, index) => (
              <Proof key={proof.en} label={t(proof)} start={26 + index * 7} />
            ))}
          </div>
        </AbsoluteFill>
      )}
      {frame >= LOGO - 2 && <Lockup />}
      <AnamorphicFlare at={0} y={0.5} length={34} color={PINK} />
      <Shockwave at={0} color={LAVENDER} />
      <Sparks at={LOGO} x={0.5} y={0.42} count={44} spread={620} seed="agentic-logo" />
    </AbsoluteFill>
  );
};

const Proof = ({ label, start: at }: { label: string; start: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 200, mass: 0.6 } });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: OSWALD,
        fontSize: 28,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: 999,
        border: `1.5px solid ${LAVENDER}77`,
        background: 'rgba(124,131,253,0.1)',
        transform: `translateY(${(1 - pop) * 30}px) scale(${0.7 + pop * 0.3})`,
        opacity: Math.min(1, pop * 1.5),
      }}
    >
      <span style={{ ...BRAND_TEXT, fontWeight: 700 }}>✓</span>
      {label}
    </div>
  );
};

/** Clappy drops onto the wordmark; the line, the address; a wink before the bars close. */
const Lockup = () => {
  const frame = useCurrentFrame() - LOGO;
  const { fps } = useVideoConfig();
  const t = useT();
  const fall = interpolate(frame, [-2, 10], [-900, 0], { ...CLAMP, easing: EASE.inQuad });
  const landing = spring({ frame: frame - 10, fps, config: { damping: 7, stiffness: 240, mass: 0.55 } });
  const squash = frame < 10 ? -0.12 : interpolate(landing, [0, 0.4, 1], [0.3, -0.08, 0]);
  const blink = useBlink(12);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 30 }}>
      <div style={{ marginBottom: -24 }}>
        <ClapBody y={fall} sx={1 + squash} sy={1 - squash}>
          <Clappy
            size={230}
            angle={frame < 10 ? -30 : -24}
            blink={frame > 70 && frame < 86 ? 0 : blink}
            {...lockupPose(frame)}
          />
        </ClapBody>
      </div>
      <SlamWordmark start={2} size={200} />
      <div style={{ marginTop: 6 }}>
        <FadeReveal text={t(COPY.outro.tagline)} start={20} size={46} weight={500} color="#fff" tracking={0.04} />
      </div>
      <div
        style={{
          marginTop: 22,
          fontFamily: MONO,
          fontSize: 24,
          color: '#c9cbe0',
          opacity: interpolate(frame, [30, 42], [0, 1], CLAMP),
        }}
      >
        leclap.dev · examples/agentic-pr-video
      </div>
    </AbsoluteFill>
  );
};

const lockupPose = (frame: number): Pick<ClappyPose, 'mood' | 'lookY' | 'armL' | 'armR'> => {
  if (frame > 70 && frame < 86) return { mood: 'wink', lookY: 0.3, armL: 34, armR: 120 };

  if (frame < 10) return { mood: 'wow', lookY: 0.3, armL: 150, armR: 150 };

  return { mood: 'grin', lookY: 0.3, armL: 34, armR: 34 };
};
