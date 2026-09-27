import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { LAVENDER } from '../brand';
import { CLAMP } from '../film/cinema';

// The app's "Record your clip" camera screen, rebuilt over real footage of someone filming themselves.
// The Android demo capture recorded the emulator's placeholder camera scene; this swaps in a person
// while keeping the exact UI of that capture (header, template chip, countdown, framing hint, record
// ring, flip button — measured off the 460x932 capture and laid out in those units, then scaled).
//
// Timeline (frames, local): the countdown shows "2" then "1", recording starts on `recordAt`.

const W = 460;
const H = 932;
const UI_FONT = "system-ui, -apple-system, 'Roboto', 'Helvetica Neue', sans-serif";

export interface RecordingScreenProps {
  /** Rendered height of the phone screen, in px (the UI is authored at 932 and scaled to fit). */
  screenHeight: number;
  /** Source clip under public/, and where in it the preview starts (seconds). */
  src: string;
  previewFrom: number;
  /** Local frame the "1" replaces the "2", and the frame recording starts. */
  oneAt: number;
  recordAt: number;
}

export const RecordingScreen = ({ screenHeight, src, previewFrom, oneAt, recordAt }: RecordingScreenProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = screenHeight / H;
  const recording = frame >= recordAt;

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo
        src={staticFile(src)}
        trimBefore={Math.round(previewFrom * fps)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: W,
          height: H,
          transform: `scale(${k})`,
          transformOrigin: '0 0',
          fontFamily: UI_FONT,
        }}
      >
        <Header />
        <TemplateChip />
        {recording ? (
          <Timer seconds={Math.floor((frame - recordAt) / fps)} />
        ) : (
          <Countdown value={frame < oneAt ? 2 : 1} since={frame < oneAt ? 0 : oneAt} />
        )}
        {!recording && <Hint />}
        <RecordButton recording={recording} since={recordAt} />
        <FlipButton />
        <div
          style={{
            position: 'absolute',
            left: W / 2 - 65,
            top: 920,
            width: 130,
            height: 5,
            borderRadius: 9,
            background: 'rgba(255,255,255,0.85)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const Header = () => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: W,
      height: 70,
      background: 'linear-gradient(180deg, rgba(10,10,14,0.62), rgba(10,10,14,0.42))',
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: 10,
        top: 12,
        width: 97,
        height: 46,
        borderRadius: 23,
        background: 'rgba(255,255,255,0.16)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 13,
        color: '#fff',
        fontSize: 19,
        fontWeight: 500,
      }}
    >
      <svg width={20} height={20} viewBox="0 0 20 20">
        <path
          d="M17 10 H4 M9 4 L3 10 L9 16"
          fill="none"
          stroke="#fff"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Back
    </div>
    <div
      style={{
        position: 'absolute',
        left: 117,
        right: 0,
        top: 21,
        textAlign: 'center',
        paddingRight: 20,
        color: '#fff',
        fontSize: 22,
        fontWeight: 700,
      }}
    >
      Record your clip
    </div>
  </div>
);

const TemplateChip = () => (
  <div
    style={{
      position: 'absolute',
      left: 10,
      top: 82,
      width: 435,
      height: 44,
      borderRadius: 22,
      background: 'rgba(22,22,30,0.88)',
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 18,
      gap: 10,
      color: '#fff',
      fontSize: 18,
    }}
  >
    <svg width={20} height={20} viewBox="0 0 20 20">
      <path d="M10 1 L12 8 L19 10 L12 12 L10 19 L8 12 L1 10 L8 8 Z" fill={LAVENDER} />
      <path d="M16 2 L16.8 4.2 L19 5 L16.8 5.8 L16 8 L15.2 5.8 L13 5 L15.2 4.2 Z" fill={LAVENDER} opacity={0.8} />
    </svg>
    Your moment — graded and captioned
    <span style={{ marginLeft: 'auto', marginRight: 18, color: '#9a9aa8', fontSize: 20 }}>×</span>
  </div>
);

/** The big countdown digit: pops in on each change, "Get ready…" beneath. */
const Countdown = ({ value, since }: { value: number; since: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - since, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: W,
          top: 330,
          textAlign: 'center',
          fontSize: 215,
          fontWeight: 800,
          lineHeight: 1,
          color: 'rgba(255,255,255,0.9)',
          textShadow: '0 6px 24px rgba(0,0,0,0.35)',
          transform: `scale(${interpolate(pop, [0, 1], [1.35, 1])})`,
          opacity: Math.min(1, pop * 1.5),
        }}
      >
        {value}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: W,
          top: 556,
          textAlign: 'center',
          color: '#fff',
          fontSize: 21,
          fontWeight: 700,
          textShadow: '0 2px 10px rgba(0,0,0,0.45)',
        }}
      >
        Get ready…
      </div>
    </>
  );
};

const Hint = () => (
  <div
    style={{
      position: 'absolute',
      left: 47,
      top: 722,
      width: 366,
      height: 35,
      borderRadius: 18,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      color: '#fff',
      fontSize: 16,
    }}
  >
    <svg width={12} height={18} viewBox="0 0 12 18">
      <rect x={1} y={1} width={10} height={16} rx={2} fill="none" stroke="#fff" strokeWidth={1.6} />
    </svg>
    Hold your device vertically for best results
  </div>
);

/** The record ring: dim red while counting down, bright and breathing once recording. */
const RecordButton = ({ recording, since }: { recording: boolean; since: number }) => {
  const frame = useCurrentFrame();
  const t = frame - since;
  const breathe = recording ? 1 + Math.sin(t / 5) * 0.03 : 1;
  const ring = recording ? interpolate(t, [0, 10], [1, 1.12], CLAMP) : 1;

  return (
    <div style={{ position: 'absolute', left: 230 - 50, top: 830 - 50, width: 100, height: 100 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '4px solid rgba(214,232,219,0.92)',
          transform: `scale(${ring})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 10,
          borderRadius: '50%',
          background: recording ? '#ff3653' : '#b3202e',
          transform: `scale(${breathe})`,
          boxShadow: recording ? '0 0 24px rgba(255,54,83,0.6)' : 'none',
        }}
      />
    </div>
  );
};

const FlipButton = () => (
  <div
    style={{
      position: 'absolute',
      left: 375 - 30,
      top: 848 - 30,
      width: 60,
      height: 60,
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <svg width={28} height={24} viewBox="0 0 28 24">
      <path
        d="M3 7 H8 L10 4 H18 L20 7 H25 V21 H3 Z"
        fill="none"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path
        d="M10 14 A4 4 0 0 1 17 11.5 M18 14 A4 4 0 0 1 11 16.5"
        fill="none"
        stroke="#fff"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  </div>
);

/** The recording timer pill with its red dot. */
const Timer = ({ seconds }: { seconds: number }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: 'absolute',
        left: W / 2 - 52,
        top: 140,
        width: 104,
        height: 34,
        borderRadius: 17,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: '#fff',
        fontSize: 17,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 9,
          background: '#ff3653',
          opacity: Math.floor(frame / 12) % 2 === 0 ? 1 : 0.35,
        }}
      />
      00:{String(seconds).padStart(2, '0')}
    </div>
  );
};
