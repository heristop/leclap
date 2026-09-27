import { type ReactNode } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { LAVENDER, PINK } from '../../brand';
import { OSWALD } from '../../fonts';
import { BRAND_TEXT, CLAMP, DriftGlow, EASE, Kicker, FadeReveal } from '../../film/cinema';
import { useT } from '../../film/lang';
import { COPY } from '../copy';
import { AttachedPr } from '../pr';
import { FPS, LOOP, STEPS, sceneById } from '../timeline';
import { CollectPanel } from './panels/collect';
import { ImplementPanel } from './panels/implement';
import { RenderPanel } from './panels/render';

// 10–32s · The loop, in the four steps of the agentic workflow (leclap.dev, #agentic). The steps sit side
// by side on one long strip and the camera dollies along it (with a little motion blur on each move),
// under a rail that fills as the agent works.

const start = sceneById('loop').from;
export const loopFrame = (seconds: number): number => Math.round((seconds - start) * FPS);

const PAN = 18;
const BOUNDARIES = STEPS.slice(1).map((step) => loopFrame(step.from));

export const LoopScene = () => {
  const frame = useCurrentFrame();
  const moves = BOUNDARIES.map((boundary) =>
    interpolate(frame, [boundary - PAN / 2, boundary + PAN / 2], [0, 1], CLAMP)
  );
  const position = moves.reduce((sum, x) => sum + EASE.inOutCubic(x), 0);
  const blur = moves.reduce((sum, x) => sum + Math.sin(Math.PI * x) * 14, 0);

  return (
    <AbsoluteFill style={{ background: '#0b0a14', overflow: 'hidden' }}>
      <DriftGlow />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1920 * STEPS.length,
          height: 1080,
          transform: `translateX(${-position * 1920}px)`,
          filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
        }}
      >
        {STEPS.map((step, index) =>
          Math.abs(position - index) < 1.1 ? (
            <div key={step.id} style={{ position: 'absolute', left: index * 1920, top: 0, width: 1920, height: 1080 }}>
              <Panel index={index} />
            </div>
          ) : null
        )}
      </div>
      <Rail position={position} />
    </AbsoluteFill>
  );
};

const Panel = ({ index }: { index: number }) => {
  const at = loopFrame(STEPS[index].from);

  return (
    <AbsoluteFill>
      <PanelContent index={index} />
      <StepHeading index={index} at={at} />
    </AbsoluteFill>
  );
};

const PanelContent = ({ index }: { index: number }): ReactNode => {
  if (index === 0) return <ImplementPanel at={loopFrame(STEPS[0].from)} testsPass={loopFrame(LOOP.testsPass)} />;

  if (index === 1) return <CollectPanel at={loopFrame(STEPS[1].from)} />;

  if (index === 2) {
    return (
      <RenderPanel
        at={loopFrame(STEPS[2].from)}
        valid={loopFrame(LOOP.valid)}
        composeFrom={loopFrame(LOOP.composeFrom)}
        composed={loopFrame(LOOP.composed)}
      />
    );
  }

  return <AttachedPr dropFrame={loopFrame(LOOP.attached)} />;
};

/** "02 · COLLECT EVIDENCE" and the step's one-line promise, top left of its panel. */
const StepHeading = ({ index, at }: { index: number; at: number }) => {
  const frame = useCurrentFrame();
  const t = useT();
  const appear = interpolate(frame, [at - 4, at + 8], [0, 1], CLAMP);
  const narrow = index === 3;
  const { id } = STEPS[index];
  const caption = t(COPY.loop.captions[id]);

  return (
    <div style={{ position: 'absolute', left: 120, top: 186, width: narrow ? 440 : 1600, opacity: appear }}>
      <Kicker appear={appear}>
        0{index + 1} · {t(COPY.loop.steps[id]).toUpperCase()}
      </Kicker>
      <div style={{ marginTop: 16 }}>
        {narrow ? (
          caption
            .split('. ')
            .map((line, lineIndex) => (
              <FadeReveal
                key={line}
                text={line.endsWith('.') ? line : `${line}.`}
                start={at + 4 + lineIndex * 4}
                size={30}
                weight={500}
                color="#e6e7f7"
                tracking={0.01}
              />
            ))
        ) : (
          <FadeReveal text={caption} start={at + 4} size={34} weight={500} color="#e6e7f7" tracking={0.01} />
        )}
      </div>
    </div>
  );
};

/** The four steps across the top: the line fills with the camera, the current step glows. */
const Rail = ({ position }: { position: number }) => {
  const t = useT();
  const left = 700;
  const span = 1100;
  const active = Math.round(position);

  return (
    <div style={{ position: 'absolute', left, top: 108, width: span, height: 60 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 13,
          height: 4,
          borderRadius: 9,
          background: 'rgba(255,255,255,0.1)',
        }}
      >
        <div
          style={{
            width: `${(position / (STEPS.length - 1)) * 100}%`,
            height: '100%',
            borderRadius: 9,
            background: `linear-gradient(90deg, ${LAVENDER}, ${PINK})`,
            boxShadow: `0 0 16px ${PINK}`,
          }}
        />
      </div>
      {STEPS.map((step, index) => {
        const on = index <= active;

        return (
          <div
            key={step.id}
            style={{
              position: 'absolute',
              left: (index / (STEPS.length - 1)) * span - 130,
              width: 260,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                margin: '0 auto',
                width: 30,
                height: 30,
                borderRadius: 999,
                background: on ? `linear-gradient(135deg, ${LAVENDER}, ${PINK})` : '#1c1b2b',
                border: `2px solid ${on ? '#fff' : 'rgba(255,255,255,0.15)'}`,
                boxShadow: index === active ? `0 0 22px ${PINK}` : 'none',
              }}
            />
            <div
              style={{
                marginTop: 8,
                fontFamily: OSWALD,
                fontSize: 18,
                letterSpacing: 3,
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                ...(index === active ? BRAND_TEXT : { color: on ? '#fff' : '#5c5e78' }),
              }}
            >
              {t(COPY.loop.steps[step.id])}
            </div>
          </div>
        );
      })}
    </div>
  );
};
