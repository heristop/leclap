import { type ReactNode } from 'react';
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { LAVENDER, PINK, YELLOW } from '../../brand';
import { OSWALD } from '../../fonts';
import {
  AnamorphicFlare,
  BRAND_TEXT,
  CLAMP,
  EASE,
  KineticWords,
  FadeReveal,
  Shockwave,
  Sparks,
  WarpLines,
  easeOutExpo,
} from '../../film/cinema';
import { ClapBody, useBlink } from '../../film/acting';
import { Clappy } from '../../film/clappy';
import { PHONE_SCREEN_ASPECT, Phone, PhoneClip } from '../../film/devices';
import { type PerLang, useLang, useT } from '../../film/lang';
import { COPY } from '../copy';
import { RecordingScreen } from '../recording-screen';
import { FPS, MOBILE, sceneById } from '../timeline';

// 32–48s · The wow. The desktop just switched off to a hot line of light; that line is where this scene
// begins — it stretches into the silhouette of a phone (a match cut on the CRT). Pick a template (Clappy
// dives into the screen as the template), shoot a clip, and the phone itself renders the video — a
// progress trace runs the bezel while the camera creeps in. On the drop the render finishes, the phone
// punches forward, rays burst behind it. Then the camera dives through the screen into the next scene.

const start = sceneById('mobile').from;
const at = (seconds: number): number => Math.round((seconds - start) * FPS);

const PICK = at(MOBILE.pick);
const SHOOT = at(MOBILE.shoot);
const RENDER = at(MOBILE.render);
const DROP = at(MOBILE.drop);
const DIVE = at(MOBILE.zoomThrough);
/** Clappy lands in the screen exactly as the demo taps "Portrait Spotlight". */
const CLAP_DIVE = 86;
const CLAP_LANDS = 104;

const PHONE_H = 800;
const PHONE_W = (PHONE_H - PHONE_H * 0.044) * PHONE_SCREEN_ASPECT + PHONE_H * 0.044;

// Where each beat of the demo is cut from (seconds into the Android capture) — read off the footage.
const SCREEN_H = PHONE_H - PHONE_H * 0.044;

// The recording beat: the app's camera screen over a person filming themselves (the capture only had
// the emulator's placeholder scene). The countdown reads "2", then "1"; recording starts on the frame
// the rendered take begins (media/render-phone-take.ts records 3.2s–9.2s of the same source).
const RECORD = { from: SHOOT + 15, oneAt: 20, recordAt: 50, takeFrom: 3.2 } as const;

type PhoneShot =
  | { kind: 'capture'; from: number; to: number; source: number; rate?: number }
  | { kind: 'recording'; from: number; to: number }
  | { kind: 'render'; from: number; to: number; rate: number; trim: number };

const SHOTS: readonly PhoneShot[] = [
  { kind: 'capture', from: PICK, to: CLAP_LANDS, source: 2.6 },
  { kind: 'capture', from: CLAP_LANDS, to: RECORD.from, source: 5.9 },
  { kind: 'recording', from: RECORD.from, to: RENDER },
  { kind: 'capture', from: RENDER, to: DROP, source: 26.6, rate: 1.75 },
  // What the phone produced: the real Present Yourself render of that take. Speed ramp — the render
  // runs at 1.75x, the result plays slow. It joins the render 1.9s in, so the title card still registers
  // and her footage lands about a second after the drop; at 0.75x the footage (which ends ~8.2s in, before
  // the render's LeClap outro) lasts through the whole dive.
  { kind: 'render', from: DROP, to: 480, rate: 0.75, trim: 1.9 },
];

const PhoneShotView = ({ shot }: { shot: PhoneShot }) => {
  if (shot.kind === 'capture') return <PhoneClip from={shot.source} playbackRate={shot.rate} />;

  if (shot.kind === 'recording') {
    return (
      <RecordingScreen
        screenHeight={SCREEN_H}
        src="captures/selfie-wave-source.mp4"
        previewFrom={RECORD.takeFrom - RECORD.recordAt / FPS}
        oneAt={RECORD.oneAt}
        recordAt={RECORD.recordAt}
      />
    );
  }

  return <FittedRender trim={shot.trim} rate={shot.rate} />;
};

/**
 * The 9:16 render on the phone's taller screen: fitted to the width so nothing is cropped (the template's
 * lower third and ON-DEVICE badge sit near the edges), over a blurred copy of itself filling the bands
 * above and below — the way a phone plays a story that's shorter than its screen.
 */
const FittedRender = ({ trim, rate }: { trim: number; rate: number }) => {
  const clip = {
    src: staticFile('captures/present-yourself-render.mp4'),
    trimBefore: Math.round(trim * FPS),
    playbackRate: rate,
    muted: true,
  } as const;

  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <OffthreadVideo
        {...clip}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'blur(26px) brightness(0.55) saturate(1.2)',
          transform: 'scale(1.2)',
        }}
      />
      <OffthreadVideo
        {...clip}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </AbsoluteFill>
  );
};

export const MobileScene = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Match cut in: the CRT line (full width, 3px) becomes the phone's rectangle.
  const form = Easing.bezier(0.7, 0, 0.2, 1)(interpolate(frame, [0, 26], [0, 1], CLAMP));
  const formed = form >= 1;

  // Tension: creep in and shake a little harder toward the drop; release on the drop.
  const creep = interpolate(frame, [RENDER - 30, DROP], [0, 1], CLAMP);
  const tension = creep ** 2;
  const shake = frame < DROP ? tension * 5 : 0;
  const shakeX = Math.sin(frame * 2.3) * shake;
  const shakeY = Math.cos(frame * 3.1) * shake;

  const punch = spring({ frame: frame - DROP, fps, config: { damping: 9, stiffness: 160, mass: 0.7 } });
  const punchScale = frame >= DROP ? interpolate(punch, [0, 1], [1.22, 1]) : 1 + creep * 0.1;

  // The dive: exponential zoom into the centre of the screen.
  const dive = interpolate(frame, [DIVE, 478], [0, 1], CLAMP);
  const diveScale = 1 + (Math.exp(dive * 3.1) - 1) * 1.4;

  const idle = Math.sin(frame / 22) * 8;
  const pulse = [0, 15, 30, 45].reduce(
    (sum, offset) => sum + interpolate(frame - (RENDER + offset), [0, 3, 12], [0, 1, 0], CLAMP),
    0
  );

  return (
    <AbsoluteFill style={{ background: '#050409', overflow: 'hidden' }}>
      <Backdrop />

      {/* behind-phone poster type, revealed on the drop */}
      <OnDevicePoster />

      {/* the phone and everything that rides with it */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            transform: `translate(${shakeX}px, ${shakeY + (formed ? idle * (1 - creep) : 0)}px) scale(${punchScale * diveScale})`,
            transformOrigin: '50% 50%',
            position: 'relative',
          }}
        >
          {!formed && <LightSlit form={form} width={width} />}
          <div style={{ opacity: interpolate(frame, [18, 30], [0, 1], CLAMP) }}>
            <Phone height={PHONE_H} glow={0.25 + pulse * 0.5 + (frame >= DROP ? 0.6 : 0)}>
              {SHOTS.map((shot) => (
                <Sequence key={shot.from} from={shot.from} durationInFrames={shot.to - shot.from} layout="none">
                  <PhoneShotView shot={shot} />
                </Sequence>
              ))}
              <ScreenBurst />
            </Phone>
            <BezelTrace />
          </div>
        </div>
      </AbsoluteFill>

      <Steps />
      <RenderReadout />
      <DropCopy />
      <ClapDive />

      <WarpLines from={DIVE + 10} to={478} />
      <AnamorphicFlare at={DROP} y={0.5} length={40} color={PINK} />
      <Shockwave at={DROP} color={LAVENDER} />
      <Sparks at={DROP + 1} count={60} spread={height * 0.9} seed="drop" />
      <DiveWhiteout />
    </AbsoluteFill>
  );
};

// ─── background ─────────────────────────────────────────────────────────────────────────────────

const Backdrop = () => {
  const frame = useCurrentFrame();
  const dropped = interpolate(frame, [DROP, DROP + 10], [0, 1], CLAMP);
  const spin = frame * 0.35 + interpolate(frame, [DIVE, 480], [0, 140], CLAMP);

  return (
    <AbsoluteFill>
      {/* before the drop: a follow-spot in the dark */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(700px 900px at 50% 45%, ${LAVENDER}2a, transparent 70%)`,
          opacity: 1 - dropped,
        }}
      />
      {/* after: the stage lights up, rays turning behind the phone */}
      <AbsoluteFill style={{ opacity: dropped }}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(1100px 800px at 50% 50%, ${LAVENDER}55, transparent 70%), radial-gradient(900px 600px at 50% 110%, ${PINK}44, transparent 70%)`,
          }}
        />
        <AbsoluteFill
          style={{
            mixBlendMode: 'screen',
            opacity: 0.55,
            background: `repeating-conic-gradient(from ${spin}deg at 50% 50%, ${LAVENDER}33 0deg 6deg, transparent 6deg 18deg, ${PINK}26 18deg 22deg, transparent 22deg 30deg)`,
            maskImage: 'radial-gradient(circle at 50% 50%, black 10%, transparent 65%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 10%, transparent 65%)',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The CRT line from the previous scene, growing into the phone's silhouette. */
const LightSlit = ({ form, width }: { form: number; width: number }) => {
  const w = interpolate(form, [0, 1], [width * 1.02, PHONE_W]);
  const h = interpolate(form, [0, 1], [3, PHONE_H]);

  return (
    <div
      style={{
        position: 'absolute',
        left: PHONE_W / 2 - w / 2,
        top: PHONE_H / 2 - h / 2,
        width: w,
        height: h,
        borderRadius: interpolate(form, [0, 1], [2, PHONE_W * 0.13]),
        background: `linear-gradient(180deg, #fff, ${LAVENDER})`,
        opacity: interpolate(form, [0.75, 1], [1, 0], CLAMP),
        boxShadow: `0 0 60px ${LAVENDER}, 0 0 140px ${PINK}`,
      }}
    />
  );
};

// ─── on the phone ───────────────────────────────────────────────────────────────────────────────

/** Where Clappy lands: a burst of light on the glass. */
const ScreenBurst = () => {
  const frame = useCurrentFrame();
  const t = frame - CLAP_LANDS;
  const opacity = interpolate(t, [0, 2, 16], [0, 0.9, 0], CLAMP);

  if (opacity <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 45%, #fff, ${PINK}aa 30%, transparent 70%)`,
        opacity,
        mixBlendMode: 'screen',
      }}
    />
  );
};

/** The render progress, traced around the bezel as a gradient stroke. */
const BezelTrace = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [RENDER, DROP - 2], [0, 1], { ...CLAMP, easing: Easing.bezier(0.3, 0, 0.3, 1) });
  const done = interpolate(frame, [DROP, DROP + 20], [1, 0], CLAMP);
  const visible = frame >= RENDER - 2 && done > 0;

  if (!visible) return null;

  const inset = -10;

  return (
    <svg
      width={PHONE_W - inset * 2}
      height={PHONE_H - inset * 2}
      style={{
        position: 'absolute',
        left: inset,
        top: inset,
        overflow: 'visible',
        opacity: done,
        filter: `drop-shadow(0 0 12px ${PINK})`,
      }}
    >
      <defs>
        <linearGradient id="trace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={LAVENDER} />
          <stop offset="1" stopColor={PINK} />
        </linearGradient>
      </defs>
      <rect
        x={3}
        y={3}
        width={PHONE_W - inset * 2 - 6}
        height={PHONE_H - inset * 2 - 6}
        rx={PHONE_W * 0.15}
        fill="none"
        stroke="url(#trace)"
        strokeWidth={6}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={`${progress} 1`}
      />
    </svg>
  );
};

/** Clappy arcs in from the right, shrinks, and dives through the glass as the template is picked. */
const ClapDive = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const enter = spring({ frame: frame - 52, fps, config: { damping: 12, stiffness: 140, mass: 0.7 } });
  const dive = interpolate(frame, [CLAP_DIVE, CLAP_LANDS], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.5, 0, 0.9, 0.6),
  });
  const blink = useBlink(8);
  // Anticipation: a crouch with arms swung back, then the launch stretches it along the arc.
  const crouch = interpolate(frame, [CLAP_DIVE - 10, CLAP_DIVE], [0, 1], { ...CLAMP, easing: EASE.outCubic });
  const launch = interpolate(dive, [0, 0.25, 0.6], [0, 1, 0], CLAMP);
  const sx = 1 + crouch * (1 - dive) * 0.14 - launch * 0.2;
  const sy = 1 - crouch * (1 - dive) * 0.18 + launch * 0.3;
  const arms = dive > 0 ? 160 : 26 - crouch * 40 + Math.sin(frame / 5) * 6;

  if (frame < 50 || frame > CLAP_LANDS) return null;

  // Parabolic arc from the perch (right of the phone) into the screen centre.
  const perchX = width / 2 + 420;
  const perchY = height / 2 + 120;
  const x = interpolate(dive, [0, 1], [perchX, width / 2]);
  const y = interpolate(dive, [0, 1], [perchY, height / 2]) - Math.sin(dive * Math.PI) * 260;
  const scale = interpolate(dive, [0, 1], [1, 0.12]) * enter;
  const spinDeg = dive * -300;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 110,
        top: y - 110 + (1 - enter) * 300,
        transform: `scale(${scale}) rotate(${spinDeg}deg)`,
      }}
    >
      <ClapBody sx={sx} sy={sy}>
        <Clappy
          size={220}
          angle={-26}
          lookX={-1}
          lookY={0.2}
          blink={blink}
          mood={dive > 0.05 ? 'wow' : 'grin'}
          armL={arms}
          armR={arms}
        />
      </ClapBody>
      <div
        style={{
          position: 'absolute',
          top: 214,
          left: -20,
          width: 260,
          textAlign: 'center',
          fontFamily: "'SF Mono', Menlo, monospace",
          fontSize: 20,
          color: YELLOW,
          opacity: 1 - dive * 3,
        }}
      >
        portrait-spotlight.json
      </div>
    </div>
  );
};

// ─── copy ───────────────────────────────────────────────────────────────────────────────────────

const STEP_COPY: readonly { at: number; until: number; n: string; lines: PerLang<readonly string[]> }[] = [
  { at: 78, until: SHOOT + 22, n: '01', lines: COPY.mobile.steps.pick },
  { at: SHOOT + 22, until: RENDER, n: '02', lines: COPY.mobile.steps.shoot },
  { at: RENDER, until: DROP, n: '03', lines: COPY.mobile.steps.render },
];

const Steps = () => {
  const frame = useCurrentFrame();
  const t = useT();
  const lang = useLang();

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 150, top: 380, opacity: interpolate(frame, [58, 70], [1, 0], CLAMP) }}>
        <FadeReveal start={14} size={104} text={t(COPY.mobile.butHeres)} color="#fff" />
        <FadeReveal start={19} size={104} text={t(COPY.mobile.theMagic)} gradient />
      </div>

      {STEP_COPY.map((step) => {
        const local = frame - step.at;
        const out = interpolate(frame, [step.until - 8, step.until], [1, 0], CLAMP);

        if (local < 0 || out <= 0) return null;

        return (
          <div key={step.n} style={{ position: 'absolute', left: 150, top: 330, opacity: out, fontFamily: OSWALD }}>
            <div
              style={{
                fontSize: 210,
                fontWeight: 700,
                lineHeight: 0.9,
                ...BRAND_TEXT,
                transform: `translateY(${(1 - easeOutExpo(Math.min(1, local / 14))) * 60}px)`,
              }}
            >
              {step.n}
            </div>
            {step.lines[lang].map((line, index) => (
              <FadeReveal key={line} start={step.at + 4 + index * 4} size={76} text={line} color="#fff" />
            ))}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * The render readout beside the phone, only while rendering: Clappy runs the progress track (the fill is
 * the render's progress; he reaches the end with it), then the label, the counter in one gradient, and the
 * no-network line.
 */
const RenderReadout = () => {
  const frame = useCurrentFrame();
  const t = useT();
  const progress = interpolate(frame, [RENDER, DROP - 2], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.3, 0, 0.3, 1),
  });
  const pct = Math.round(progress * 100);
  const opacity = interpolate(frame, [RENDER - 4, RENDER + 6, DROP, DROP + 8], [0, 1, 1, 0], CLAMP);

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        right: 170,
        top: 330,
        width: TRACK_W,
        opacity,
        fontFamily: OSWALD,
        textAlign: 'right',
      }}
    >
      <LoadingRun progress={progress} />
      <div style={{ marginTop: 26, fontSize: 26, letterSpacing: 6, color: '#c9cbe0' }}>
        {t(COPY.mobile.renderingOnDevice)}
      </div>
      {/* One gradient across the digits and the sign: this is the film's "the phone renders it" moment. */}
      <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', ...BRAND_TEXT }}>
        {pct}
        <span style={{ fontSize: 60 }}>%</span>
      </div>
      <div style={{ fontSize: 24, letterSpacing: 4, color: '#8a8ca6' }}>{t(COPY.mobile.noNetwork)}</div>
    </div>
  );
};

const TRACK_W = 440;
const RUNNER = 120;
/** Run-cycle turns per frame: a quick trot, a little over two strides a second. */
const CADENCE = 0.075;

/**
 * The loader: a slim track that fills as Clappy runs it left to right — feet trading places, arms pumping,
 * the clapper clacking on each step, a bob and a forward lean, dust puffing behind. A grin on arrival.
 */
const LoadingRun = ({ progress }: { progress: number }) => {
  const frame = useCurrentFrame();
  const stride = frame * CADENCE;
  const swing = Math.sin(stride * Math.PI * 2);
  const bob = Math.abs(Math.cos(stride * Math.PI * 2));
  const arrived = progress >= 0.97;
  const x = progress * (TRACK_W - RUNNER);

  return (
    <div style={{ position: 'relative', height: RUNNER + 10 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 8,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            borderRadius: 99,
            backgroundImage: `linear-gradient(90deg, ${LAVENDER}, ${PINK})`,
          }}
        />
      </div>
      {!arrived && <Dust x={x} stride={stride} />}
      <div style={{ position: 'absolute', left: x, bottom: 2 }}>
        <ClapBody y={-bob * 10} rotate={arrived ? 0 : 8} sx={1 + bob * 0.03} sy={1 - bob * 0.03}>
          <Clappy
            size={RUNNER}
            stride={arrived ? undefined : stride}
            armL={arrived ? 140 : 44 + swing * 30}
            armR={arrived ? 140 : 44 - swing * 30}
            angle={-22 + Math.sin(stride * Math.PI * 4) * 6}
            mood={arrived ? 'grin' : 'focused'}
            lookX={0.6}
          />
        </ClapBody>
      </div>
    </div>
  );
};

/** Three puffs kicked up behind the runner, each drifting back and fading over one stride. */
const Dust = ({ x, stride }: { x: number; stride: number }) => (
  <>
    {[0, 1, 2].map((index) => {
      const age = (stride + index / 3) % 1;

      return (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: x + 18 - age * 46,
            bottom: 8 + age * 14,
            width: 10 + age * 16,
            height: 10 + age * 16,
            borderRadius: '50%',
            background: 'rgba(240,236,255,0.9)',
            opacity: (1 - age) * 0.7,
            filter: 'blur(2px)',
          }}
        />
      );
    })}
  </>
);

/** After the drop: the headline on the left, the three proof chips on the right, synced to the voice. */
const DropCopy = () => {
  const frame = useCurrentFrame();
  const t = useT();
  const lang = useLang();
  const out = interpolate(frame, [DIVE, DIVE + 12], [1, 0], CLAMP);

  if (frame < DROP || out <= 0) return null;

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: 'absolute', left: 130, top: 360, width: 560 }}>
        <KineticWords
          text={t(COPY.mobile.rendered)}
          start={DROP + 4}
          size={COPY.mobile.renderedSize[lang]}
          align="left"
        />
        <KineticWords
          text={t(COPY.mobile.onYourPhone)}
          start={DROP + 10}
          size={COPY.mobile.renderedSize[lang]}
          align="left"
          gradientWords={COPY.mobile.onYourPhoneGradient[lang]}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 130,
          top: 380,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          alignItems: 'flex-end',
        }}
      >
        <ProofChip start={at(42.35)} label={t(COPY.mobile.proofs.server)} icon={<CloudOff />} />
        <ProofChip start={at(43.1)} label={t(COPY.mobile.proofs.upload)} icon={<UploadOff />} />
        <ProofChip start={at(43.85)} label={t(COPY.mobile.proofs.device)} icon={<Lock />} />
      </div>
    </AbsoluteFill>
  );
};

const ProofChip = ({ start, label, icon }: { start: number; label: string; icon: ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - start, fps, config: { damping: 11, stiffness: 200, mass: 0.6 } });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '16px 30px 16px 20px',
        borderRadius: 999,
        background: 'rgba(20,18,36,0.78)',
        border: `1.5px solid ${LAVENDER}88`,
        boxShadow: `0 16px 40px rgba(0,0,0,0.5), 0 0 30px ${LAVENDER}44`,
        transform: `translateX(${(1 - pop) * 120}px) scale(${0.6 + pop * 0.4})`,
        opacity: Math.min(1, pop * 1.6),
        fontFamily: OSWALD,
        fontSize: 44,
        fontWeight: 600,
        color: '#fff',
        textTransform: 'uppercase',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 999,
          background: `linear-gradient(135deg, ${LAVENDER}, ${PINK})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      {label}
    </div>
  );
};

const ICON = { fill: 'none', stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const CloudOff = () => (
  <svg width={32} height={32} viewBox="0 0 32 32">
    <path d="M9 23 H23 A5 5 0 0 0 22 13 A7 7 0 0 0 9 14 A4.5 4.5 0 0 0 9 23 Z" {...ICON} />
    <path d="M5 5 L27 27" {...ICON} />
  </svg>
);

const UploadOff = () => (
  <svg width={32} height={32} viewBox="0 0 32 32">
    <path d="M16 22 V8 M10 14 L16 8 L22 14 M8 25 H24" {...ICON} />
    <path d="M5 5 L27 27" {...ICON} />
  </svg>
);

const Lock = () => (
  <svg width={32} height={32} viewBox="0 0 32 32">
    <rect x="8" y="14" width="16" height="12" rx="3" {...ICON} />
    <path d="M11 14 V10 A5 5 0 0 1 21 10 V14" {...ICON} />
  </svg>
);

/**
 * "ON-DEVICE" set huge behind the phone: an outline that a gradient fill wipes through on the drop. It sits
 * in the lower band, under the headline, with the first word anchored whole — centred, the frame only ever
 * showed the middle of the marquee ("N-DEV"), colliding with the headline.
 */
const OnDevicePoster = () => {
  const frame = useCurrentFrame();
  const lang = useLang();
  const t = frame - DROP;

  if (t < 0) return null;

  const wipe = easeOutExpo(Math.min(1, t / 24));
  const drift = t * 0.9;
  const fade = interpolate(frame, [DIVE, DIVE + 10], [1, 0], CLAMP);
  const type = {
    fontFamily: OSWALD,
    fontWeight: 700,
    fontSize: COPY.mobile.posterSize[lang],
    lineHeight: 1,
    letterSpacing: 6,
    whiteSpace: 'nowrap',
  } as const;
  const word = COPY.mobile.poster[lang];
  const marquee = `${word} ${word}`;

  return (
    <AbsoluteFill
      style={{ alignItems: 'flex-start', justifyContent: 'flex-end', padding: '0 0 24px 220px', opacity: 0.22 * fade }}
    >
      <div style={{ position: 'relative', transform: `translateX(${-drift}px)` }}>
        <div style={{ ...type, color: 'transparent', WebkitTextStroke: `3px ${LAVENDER}` }}>{marquee}</div>
        <div
          style={{
            ...type,
            ...BRAND_TEXT,
            position: 'absolute',
            inset: 0,
            clipPath: `inset(0 ${100 - wipe * 100}% 0 0)`,
          }}
        >
          {marquee}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** The last frames of the dive burn out to white, cutting on the whoosh. */
const DiveWhiteout = () => {
  const frame = useCurrentFrame();
  const tint = interpolate(frame, [DIVE + 8, 460], [0, 0.55], CLAMP);
  const opacity = interpolate(frame, [460, 478], [0, 1], CLAMP);

  if (frame < DIVE + 8) return null;

  return (
    <>
      {/* the pixels rushing past take on the brand light as we fall through the glass */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${PINK}, ${LAVENDER} 45%, #1a1440 100%)`,
          mixBlendMode: 'color',
          opacity: tint,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle, #fff 30%, ${LAVENDER})`, opacity }} />
    </>
  );
};
