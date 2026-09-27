import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, PINK } from '../../brand';
import {
  AnamorphicFlare,
  CLAMP,
  DriftGlow,
  EASE,
  SceneShell,
  Shockwave,
  Sparks,
  TrackingTitle,
} from '../../film/cinema';
import { ClapBody, useBlink } from '../../film/acting';
import { Clappy } from '../../film/clappy';
import { useT } from '../../film/lang';
import { SlamWordmark } from '../../film/wordmark';
import { COPY } from '../copy';

// 6–10s · The title. The curtain is gone; on the boom each letter of the wordmark slams out of depth,
// a beat apart, and the continuous brand gradient pours over the settled word. Clappy falls back in from
// where it jumped (gravity: ease-in), squashes on landing, springs up into a ta-da.
// Exit: the camera flies INTO the wordmark.

const LAND = 12;

export const TitleScene = () => (
  <SceneShell enter="none" exit="zoom" exitOrigin="50% 60%" exitFrames={12}>
    <TitleBody />
  </SceneShell>
);

const TitleBody = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = useT();

  const push = interpolate(frame, [0, durationInFrames], [1, 1.08]);
  const beams = interpolate(frame, [0, durationInFrames], [-14, 14]);

  // Clappy: free fall (ease-in = gravity), squash on contact, spring back, then a ta-da with arms up.
  const fall = interpolate(frame, [0, LAND], [-980, 0], { ...CLAMP, easing: EASE.inQuad });
  const landing = spring({ frame: frame - LAND, fps, config: { damping: 7, stiffness: 240, mass: 0.55 } });
  const squash = frame < LAND ? -0.12 : interpolate(landing, [0, 0.4, 1], [0.3, -0.08, 0]);
  const tada = spring({ frame: frame - 34, fps, config: { damping: 10, stiffness: 160 } });
  const blink = useBlink(40);

  return (
    <AbsoluteFill style={{ background: '#0b0a14', overflow: 'hidden' }}>
      <DriftGlow intensity={1.3} />
      <AbsoluteFill
        style={{
          mixBlendMode: 'screen',
          background: `conic-gradient(from ${170 + beams}deg at 20% -5%, transparent 0deg, ${LAVENDER}30 6deg, transparent 14deg),
            conic-gradient(from ${176 - beams}deg at 80% -5%, transparent 0deg, ${PINK}2a 6deg, transparent 14deg)`,
        }}
      />

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${push})` }}>
        <div style={{ marginBottom: -24 }}>
          <ClapBody y={fall - tada * 18} sx={1 + squash} sy={1 - squash}>
            <Clappy
              size={250}
              angle={-24 - tada * 6}
              blink={blink}
              mood={frame < LAND ? 'wow' : 'grin'}
              lookY={0.35}
              armL={interpolate(tada, [0, 1], [frame < LAND ? 150 : 40, 150])}
              armR={interpolate(tada, [0, 1], [frame < LAND ? 150 : 40, 150])}
            />
          </ClapBody>
        </div>

        <SlamWordmark />

        <div style={{ marginTop: 8 }}>
          <TrackingTitle text={t(COPY.tagline)} start={28} size={52} color="#fff" weight={500} />
        </div>
      </AbsoluteFill>

      <AnamorphicFlare at={0} y={0.62} length={36} />
      <Shockwave at={0} y={0.62} color={LAVENDER} />
      <Sparks at={1} x={0.5} y={0.62} count={48} spread={height * 0.8} seed="title" />
      <Sparks at={LAND} x={0.5} y={0.4} count={18} spread={width * 0.1} seed="land" />
    </AbsoluteFill>
  );
};
