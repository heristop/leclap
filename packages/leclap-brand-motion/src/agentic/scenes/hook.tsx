import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CLAMP, DriftGlow, EASE, FadeReveal } from '../../film/cinema';
import { ClapBody, useBlink, useClap, useHop } from '../../film/acting';
import { Clappy, type ClappyMood } from '../../film/clappy';
import { useT } from '../../film/lang';
import { SquintGauge } from '../../film/squint-gauge';
import { COPY } from '../copy';
import { ProsePr } from '../pr';
import { CLAP, FPS } from '../timeline';

// 0–6s · The problem. A pull request arrives as prose: a careful description, a diff stat, "Screenshots:
// —". The camera drifts down the text like a reviewer reading; the squint-o-meter sits in the red.
// Clappy hops up, reads along, winds up — and its clap is the cut to the title.

const SLAM = Math.round(CLAP * FPS);
const LINE_2 = 84;

export const HookScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 80, mass: 1 } });
  const scroll = interpolate(frame, [20, 170], [0, 190], { ...CLAMP, easing: EASE.inOutCubic });
  const line1 = interpolate(frame, [LINE_2 - 10, LINE_2 - 2], [1, 0], CLAMP);

  return (
    <AbsoluteFill style={{ background: '#0b0a14', overflow: 'hidden' }}>
      <DriftGlow intensity={0.8} />

      <AbsoluteFill style={{ perspective: 1800 }}>
        <div
          style={{
            position: 'absolute',
            left: 930,
            top: 150,
            transform: `rotateY(${interpolate(enter, [0, 1], [-38, -20])}deg) rotateX(8deg) translateZ(${interpolate(enter, [0, 1], [-500, 0])}px)`,
            transformOrigin: '0% 50%',
            opacity: enter,
          }}
        >
          <ProsePr scroll={scroll} />
        </div>
      </AbsoluteFill>

      <div style={{ position: 'absolute', left: 120, top: 300, opacity: line1 }}>
        <FadeReveal text={t(COPY.hook.agent1)} start={20} size={92} />
        <FadeReveal text={t(COPY.hook.agent2)} start={26} size={92} />
      </div>
      {frame >= LINE_2 - 2 && (
        <div style={{ position: 'absolute', left: 120, top: 300 }}>
          <FadeReveal text={t(COPY.hook.reviewer1)} start={LINE_2} size={92} />
          <FadeReveal text={t(COPY.hook.reviewer2)} start={LINE_2 + 6} size={92} gradient />
        </div>
      )}

      <div
        style={{ position: 'absolute', left: 130, bottom: 120, opacity: interpolate(frame, [30, 45], [0, 1], CLAMP) }}
      >
        <SquintGauge relief={0} label={t(COPY.squint)} width={210} />
      </div>

      <Reader />
    </AbsoluteFill>
  );
};

/** Clappy hops up at the edge of the PR, reads along, then winds up and claps the cut. */
const Reader = () => {
  const frame = useCurrentFrame();
  const hop = useHop(104, 110, 14);
  const { angle, impact } = useClap(SLAM);
  const blink = useBlink(18);
  const windUp = interpolate(frame, [SLAM - 14, SLAM - 5, SLAM], [0, 1, 0.2], CLAMP);
  const appear = interpolate(frame, [104, 110], [0, 1], CLAMP);
  const arms = windUp > 0 ? 30 + windUp * 135 : 30 + Math.sin(frame / 6) * 6;

  return (
    <div style={{ position: 'absolute', left: 560, bottom: 70, opacity: appear }}>
      <ClapBody
        y={hop.y}
        sx={hop.sx + impact * 0.12 + windUp * 0.06}
        sy={hop.sy - impact * 0.14 - windUp * 0.08}
        rotate={4 - impact * 4}
      >
        <Clappy
          size={220}
          angle={angle}
          lookX={0.9}
          lookY={-0.6}
          blink={blink}
          mood={readerMood(frame)}
          armL={arms}
          armR={arms}
        />
      </ClapBody>
    </div>
  );
};

/** Puzzled by the prose, then focused for the clap. */
const readerMood = (frame: number): ClappyMood => {
  if (frame > SLAM - 14) return 'focused';

  if (frame > 124) return 'wow';

  return 'smile';
};
