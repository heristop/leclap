import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, PINK } from '../../brand';
import { OSWALD } from '../../fonts';
import {
  AnamorphicFlare,
  BRAND_TEXT,
  CLAMP,
  DriftGlow,
  EASE,
  FadeReveal,
  Shockwave,
  Sparks,
  TrackingTitle,
} from '../../film/cinema';
import { ClapBody, useBlink } from '../../film/acting';
import { Clappy, type ClappyPose } from '../../film/clappy';
import { useT } from '../../film/lang';
import { SlamWordmark } from '../../film/wordmark';
import { COPY } from '../copy';

// 70–78s · The finale — the title's rhyme, with a variation. Clappy's slam at the end of the last scene
// lands us here on the boom: Clappy drops onto the lockup, the wordmark slams in again, the line, the
// platforms, the address. Clappy takes a bow, straightens, winks at camera. The letterbox closes.

const LAND = 12;

export const FinaleScene = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = useT();

  const fall = interpolate(frame, [0, LAND], [-1000, 0], { ...CLAMP, easing: EASE.inQuad });
  const landing = spring({ frame: frame - LAND, fps, config: { damping: 7, stiffness: 240, mass: 0.55 } });
  const squash = frame < LAND ? -0.12 : interpolate(landing, [0, 0.4, 1], [0.3, -0.08, 0]);
  // The bow: anticipation (lean back), bow forward, hold, straighten with a little overshoot.
  const bow = interpolate(frame, [138, 146, 158, 172, 182], [0, -6, 24, 24, 0], { ...CLAMP, easing: EASE.inOutCubic });
  const blink = useBlink(15);
  const pose = finalePose(frame, bow);
  const push = interpolate(frame, [0, durationInFrames], [1, 1.06]);
  const rays = frame * 0.25;

  return (
    <AbsoluteFill style={{ background: '#0b0a14', overflow: 'hidden' }}>
      <DriftGlow intensity={1.4} />
      <AbsoluteFill
        style={{
          mixBlendMode: 'screen',
          opacity: 0.4,
          background: `repeating-conic-gradient(from ${rays}deg at 50% 44%, ${LAVENDER}2a 0deg 5deg, transparent 5deg 15deg)`,
          maskImage: 'radial-gradient(circle at 50% 44%, black 5%, transparent 60%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 44%, black 5%, transparent 60%)',
        }}
      />

      <AbsoluteFill
        style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${push})`, paddingBottom: 40 }}
      >
        <div style={{ marginBottom: -28 }}>
          <ClapBody y={fall} sx={1 + squash} sy={1 - squash} rotate={bow}>
            <Clappy size={250} angle={frame < LAND ? -30 : -24} blink={pose.mood === 'wink' ? 0 : blink} {...pose} />
          </ClapBody>
        </div>

        <SlamWordmark start={2} size={250} />

        <div style={{ marginTop: 4 }}>
          <TrackingTitle text={t(COPY.tagline)} start={28} size={50} weight={500} />
        </div>

        <div style={{ display: 'flex', gap: 22, marginTop: 34, alignItems: 'center' }}>
          {COPY.finale.platforms.map((platform, index) => (
            <PlatformChip key={platform.en} label={t(platform)} start={70 + index * 4} />
          ))}
        </div>

        <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <FadeReveal text="leclap.dev" start={112} size={70} gradient tracking={0.04} />
          <div
            style={{
              fontFamily: OSWALD,
              fontWeight: 300,
              fontSize: 28,
              letterSpacing: 3,
              color: '#c9cbe0',
              opacity: interpolate(frame, [124, 136], [0, 1], CLAMP),
            }}
          >
            {t(COPY.finale.openSource)}
          </div>
        </div>
      </AbsoluteFill>

      <AnamorphicFlare at={0} y={0.52} length={38} color={PINK} />
      <Shockwave at={0} y={0.5} color={LAVENDER} />
      <Sparks at={1} x={0.5} y={0.5} count={56} spread={height * 0.85} seed="finale" />
      <Sparks at={LAND} x={0.5} y={0.3} count={16} spread={width * 0.1} seed="finale-land" />
    </AbsoluteFill>
  );
};

/**
 * The finale's acting, beat by beat: arms up in the fall, a grin on landing, arms forward for the bow
 * (eyes down, proud), then a wink with a little salute.
 */
const finalePose = (frame: number, bow: number): Pick<ClappyPose, 'mood' | 'lookY' | 'armL' | 'armR'> => {
  if (frame > 196 && frame < 214) return { mood: 'wink', lookY: 0.3, armL: 34, armR: 120 };

  if (frame < LAND) return { mood: 'wow', lookY: 0.3, armL: 150, armR: 150 };

  if (bow > 10) return { mood: 'proud', lookY: 0.8, armL: 60, armR: 60 };

  if (bow > 4) return { mood: 'grin', lookY: 0.3, armL: 60, armR: 60 };

  return { mood: 'grin', lookY: 0.3, armL: 34, armR: 34 };
};

const PlatformChip = ({ label, start }: { label: string; start: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - start, fps, config: { damping: 11, stiffness: 200, mass: 0.6 } });

  return (
    <div
      style={{
        fontFamily: OSWALD,
        fontSize: 30,
        letterSpacing: 4,
        textTransform: 'uppercase',
        color: '#fff',
        padding: '8px 24px',
        borderRadius: 999,
        border: `1.5px solid ${LAVENDER}77`,
        background: 'rgba(124,131,253,0.1)',
        transform: `translateY(${(1 - pop) * 30}px) scale(${0.7 + pop * 0.3})`,
        opacity: Math.min(1, pop * 1.5),
      }}
    >
      <span style={BRAND_TEXT}>●</span> {label}
    </div>
  );
};
