import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, PINK } from '../../brand';
import {
  AnamorphicFlare,
  CLAMP,
  DriftGlow,
  EASE,
  Kicker,
  KineticWords,
  SceneShell,
  Shockwave,
  Sparks,
} from '../../film/cinema';
import { ClapBody, useBlink } from '../../film/acting';
import { Clappy } from '../../film/clappy';
import { useLang, useT } from '../../film/lang';
import { COPY, TIMING } from '../copy';

// 6–10s · The line. On the boom: "Don't describe the change." Clappy free-falls in beside it and squashes
// on landing; on the narrator's "Show it." the punchline lands big and Clappy springs into a ta-da. Exit: a
// whip pan into the loop.

const LAND = 12;

export const TitleScene = () => (
  <SceneShell enter="none" exit="whip" exitFrames={10}>
    <TitleBody />
  </SceneShell>
);

const TitleBody = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = useT();
  const lang = useLang();
  // The narrator's "Show it." / "Montrez-le." (copy.ts → TIMING); the type leads the word a touch.
  const showIt = TIMING.showIt[lang];
  const push = interpolate(frame, [0, durationInFrames], [1, 1.06]);
  const kicker = spring({ frame: frame - 2, fps, config: { damping: 16 } });
  const fall = interpolate(frame, [0, LAND], [-980, 0], { ...CLAMP, easing: EASE.inQuad });
  const landing = spring({ frame: frame - LAND, fps, config: { damping: 7, stiffness: 240, mass: 0.55 } });
  const squash = frame < LAND ? -0.12 : interpolate(landing, [0, 0.4, 1], [0.3, -0.08, 0]);
  const tada = spring({ frame: frame - showIt, fps, config: { damping: 10, stiffness: 160 } });
  const blink = useBlink(40);
  const beams = interpolate(frame, [0, durationInFrames], [-14, 14]);

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
        <div style={{ marginBottom: 26 }}>
          <Kicker appear={kicker}>{t(COPY.title.kicker)}</Kicker>
        </div>
        <KineticWords text={t(COPY.title.dontDescribe)} start={0} size={COPY.title.dontDescribeSize[lang]} />
        <div style={{ marginTop: 10 }}>
          <KineticWords
            text={t(COPY.title.showIt)}
            start={showIt}
            size={COPY.title.showItSize[lang]}
            gradientWords={COPY.title.showItGradient[lang]}
          />
        </div>
      </AbsoluteFill>

      {/* far enough right to clear the headline, even with the stick raised */}
      <div style={{ position: 'absolute', right: 56, bottom: 96 }}>
        <ClapBody y={fall - tada * 16} sx={1 + squash} sy={1 - squash}>
          <Clappy
            size={230}
            angle={-24 - tada * 6}
            blink={blink}
            mood={frame < LAND ? 'wow' : 'grin'}
            lookX={-0.8}
            lookY={-0.2}
            armL={interpolate(tada, [0, 1], [frame < LAND ? 150 : 40, 150])}
            armR={interpolate(tada, [0, 1], [frame < LAND ? 150 : 40, 150])}
          />
        </ClapBody>
      </div>

      <AnamorphicFlare at={0} y={0.5} length={36} />
      <Shockwave at={0} y={0.5} color={LAVENDER} />
      <Sparks at={1} x={0.5} y={0.5} count={48} spread={760} seed="agentic-title" />
      <Sparks at={LAND} x={0.86} y={0.78} count={16} spread={200} seed="agentic-land" />
      <Sparks at={showIt + 4} x={0.5} y={0.6} count={30} spread={560} seed="agentic-show-it" />
    </AbsoluteFill>
  );
};
