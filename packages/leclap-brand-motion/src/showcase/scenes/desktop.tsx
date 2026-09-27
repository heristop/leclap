import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { LAVENDER, PINK } from '../../brand';
import { OSWALD } from '../../fonts';
import { BRAND_TEXT, CLAMP, DriftGlow, Kicker, KineticWords, SceneShell } from '../../film/cinema';
import { BrowserWindow } from '../../film/devices';
import { type Bilingual, type Lang, type PerLang, useLang, useT } from '../../film/lang';
import { COPY, TIMING } from '../copy';

// 24–32s · The desktop. Real /studio and builder screen-recordings play in a browser window that swings
// in from off-axis; a film-strip rail on the left ticks through the four steps as the footage changes.
// Exit: the monitor switches off like an old CRT — the next scene opens in the dark.

interface Step {
  label: Bilingual;
  src: string;
  /** Scene frame the step lands on, per language — it follows the narration (copy.ts → TIMING). */
  from: PerLang<number>;
  /** Source capture aspect, so it fills the window without letterboxing. */
  aspect: number;
  /** Frames to skip at the head of the capture (the recordings open on the app's blank loading page). */
  trim: number;
  /** Playback speed, when the action in the capture runs longer than the step. */
  rate?: number;
}

const STEPS: readonly Step[] = [
  // Each step lands just ahead of its phrase in vo-06 (English: drop 26.5s, trim 28.1s, build 29.6s). Cut points
  // read off the 2x screencasts (apps/leclap-web/scripts/capture-{studio,builder}.ts): the gallery scrolling; the
  // clip landing a beat after "No clip yet"; both trim handles sliding in; the caption retyped.
  {
    label: COPY.desktop.steps.pick,
    src: 'studio-gallery',
    from: TIMING.desktopSteps.pick,
    aspect: 1600 / 900,
    trim: 3,
  },
  {
    label: COPY.desktop.steps.drop,
    src: 'studio-compose',
    from: TIMING.desktopSteps.drop,
    aspect: 1600 / 900,
    trim: 42,
  },
  {
    label: COPY.desktop.steps.trim,
    src: 'studio-trim',
    from: TIMING.desktopSteps.trim,
    aspect: 1600 / 900,
    trim: 3,
    rate: 1.5,
  },
  {
    label: COPY.desktop.steps.build,
    src: 'build-scenes',
    from: TIMING.desktopSteps.build,
    aspect: 1440 / 900,
    trim: 60,
    rate: 1.55,
  },
];

/** Where step `index` hands over to the next one (the scene's end for the last). */
const stepEnd = (index: number, lang: Lang, sceneEnd: number): number =>
  index === STEPS.length - 1 ? sceneEnd : STEPS[index + 1].from[lang];

const WINDOW_W = 1080;
const VIEW_H = WINDOW_W / (1600 / 900);

export const DesktopScene = () => (
  <SceneShell enter="punch" exit="crt" exitFrames={12}>
    <DesktopBody />
  </SceneShell>
);

const DesktopBody = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = useT();
  const lang = useLang();
  const swing = spring({ frame, fps, config: { damping: 18, stiffness: 90, mass: 1 } });
  const drift = interpolate(frame, [0, durationInFrames], [0, 1]);
  const kicker = spring({ frame: frame - 2, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ background: '#0b0a14' }}>
      <DriftGlow />

      <div style={{ position: 'absolute', left: 120, top: 190, width: 560 }}>
        <Kicker appear={kicker}>{t(COPY.desktop.kicker)}</Kicker>
        <div style={{ marginTop: 28 }}>
          <KineticWords text={t(COPY.desktop.builtIn)} start={6} size={COPY.desktop.headlineSize[lang]} align="left" />
          <KineticWords
            text={t(COPY.desktop.theBrowser)}
            start={12}
            size={COPY.desktop.headlineSize[lang]}
            align="left"
            gradientWords={COPY.desktop.theBrowserGradient[lang]}
          />
        </div>
        <StepRail />
      </div>

      <AbsoluteFill style={{ perspective: 1700 }}>
        <div
          style={{
            position: 'absolute',
            left: 660,
            top: 200,
            transform: `translateZ(${interpolate(swing, [0, 1], [-900, 0]) + drift * 60}px) rotateY(${interpolate(swing, [0, 1], [-48, -14]) + drift * 5}deg) rotateX(${interpolate(swing, [0, 1], [18, 4])}deg)`,
            transformOrigin: '30% 50%',
          }}
        >
          <BrowserWindow width={WINDOW_W} address="leclap.dev/studio">
            <div style={{ height: VIEW_H, position: 'relative', background: '#111' }}>
              {STEPS.map((step, index) => (
                <Sequence
                  key={step.src}
                  from={step.from[lang]}
                  durationInFrames={stepEnd(index, lang, durationInFrames) - step.from[lang]}
                  layout="none"
                >
                  <OffthreadVideo
                    src={staticFile(`captures/${step.src}.mp4`)}
                    trimBefore={step.trim}
                    playbackRate={step.rate ?? 1}
                    muted
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: '50% 0%',
                    }}
                  />
                </Sequence>
              ))}
              <InnerFlash />
            </div>
          </BrowserWindow>
          {/* floor glow under the window */}
          <div
            style={{
              position: 'absolute',
              left: '10%',
              right: '10%',
              bottom: -80,
              height: 60,
              borderRadius: '50%',
              background: `${LAVENDER}55`,
              filter: 'blur(40px)',
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A hint of a light pop inside the window on each footage change — kept faint, a full white flash reads as a glitch. */
const InnerFlash = () => {
  const frame = useCurrentFrame();
  const lang = useLang();
  const opacity = STEPS.slice(1).reduce((max, step) => {
    const from = step.from[lang];

    return Math.max(max, interpolate(frame, [from - 1, from, from + 4], [0, 0.25, 0], CLAMP));
  }, 0);

  return <AbsoluteFill style={{ background: '#fff', opacity }} />;
};

/** The film-strip rail: sprocket holes down a hairline, each step lighting as its footage plays. */
const StepRail = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = useT();
  const lang = useLang();
  const size = COPY.desktop.stepSize[lang];

  return (
    <div style={{ marginTop: 56, position: 'relative', paddingLeft: 42 }}>
      <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: `${LAVENDER}44` }} />
      {Array.from({ length: 10 }, (_, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 4,
            top: index * 30 + 6,
            width: 10,
            height: 10,
            borderRadius: 3,
            background: `${LAVENDER}66`,
          }}
        />
      ))}
      {STEPS.map((step, index) => {
        const from = step.from[lang];
        const appear = spring({ frame: frame - from - 4, fps, config: { damping: 15 } });
        const active = frame >= from && frame < stepEnd(index, lang, durationInFrames);

        return (
          <div
            key={step.src}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 18,
              marginBottom: 22,
              opacity: appear * (active ? 1 : 0.4),
              transform: `translateX(${(1 - appear) * -30}px)`,
              fontFamily: OSWALD,
            }}
          >
            <span style={{ fontSize: size, fontWeight: 700, ...(active ? BRAND_TEXT : { color: '#6b6d88' }) }}>
              0{index + 1}
            </span>
            <span style={{ fontSize: size, fontWeight: 500, color: '#fff', textTransform: 'uppercase' }}>
              {t(step.label)}
            </span>
            {active && (
              <span
                style={{ width: 12, height: 12, borderRadius: 9, background: PINK, boxShadow: `0 0 16px ${PINK}` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
