import { type CSSProperties, type ReactNode } from 'react';
import { OffthreadVideo, staticFile } from 'remotion';
import { LAVENDER } from '../brand';
import { OSWALD } from '../fonts';

// Device frames for the showcase: a handset, a browser window and a terminal. Plain, rounded, brand-
// tinted — at trailer pace they need to read as "a phone", "a browser", "a shell" in one glance.

/** Aspect of public/captures/android-demo-screen.mp4 (a 460x932 crop of the Android demo). */
export const PHONE_SCREEN_ASPECT = 460 / 932;

export const Phone = ({
  height,
  children,
  glow = 0,
  style,
}: {
  height: number;
  children: ReactNode;
  glow?: number;
  style?: CSSProperties;
}) => {
  const bezel = height * 0.022;
  const screenHeight = height - bezel * 2;
  const width = screenHeight * PHONE_SCREEN_ASPECT + bezel * 2;

  return (
    <div
      style={{
        width,
        height,
        padding: bezel,
        borderRadius: width * 0.13,
        background: 'linear-gradient(160deg, #2a2a38, #07070b 40%)',
        border: '1.5px solid rgba(255,255,255,0.22)',
        boxShadow: `0 ${height * 0.04}px ${height * 0.1}px rgba(0,0,0,0.65), 0 0 ${120 * glow}px ${LAVENDER}${glow > 0 ? 'aa' : '00'}`,
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: width * 0.105,
          overflow: 'hidden',
          position: 'relative',
          background: '#000',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** A clip from the Android demo, cut from `from` (seconds into the demo). */
export const PhoneClip = ({ from, playbackRate = 1 }: { from: number; playbackRate?: number }) => (
  <OffthreadVideo
    src={staticFile('captures/android-demo-screen.mp4')}
    trimBefore={Math.round(from * 30)}
    playbackRate={playbackRate}
    muted
    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
  />
);

export const BrowserWindow = ({
  width,
  address,
  children,
  style,
}: {
  width: number;
  address: string;
  children: ReactNode;
  style?: CSSProperties;
}) => {
  const bar = width * 0.036;
  const dot = bar * 0.26;

  return (
    <div
      style={{
        width,
        borderRadius: width * 0.012,
        overflow: 'hidden',
        background: '#15151f',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: `0 ${width * 0.03}px ${width * 0.07}px rgba(0,0,0,0.6)`,
        ...style,
      }}
    >
      <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: dot * 0.8, padding: `0 ${dot * 1.4}px` }}>
        <span style={{ width: dot, height: dot, borderRadius: 999, background: '#ff5f57' }} />
        <span style={{ width: dot, height: dot, borderRadius: 999, background: '#febc2e' }} />
        <span style={{ width: dot, height: dot, borderRadius: 999, background: '#28c840' }} />
        <div
          style={{
            margin: '0 auto',
            width: '44%',
            height: bar * 0.56,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9a9cb6',
            fontFamily: OSWALD,
            fontSize: bar * 0.34,
            letterSpacing: 1,
          }}
        >
          {address}
        </div>
      </div>
      <div style={{ position: 'relative', overflow: 'hidden' }}>{children}</div>
    </div>
  );
};

export const Capture = ({ src, trimBefore = 0 }: { src: string; trimBefore?: number }) => (
  <OffthreadVideo
    src={staticFile(`captures/${src}.mp4`)}
    trimBefore={trimBefore}
    muted
    style={{ width: '100%', display: 'block' }}
  />
);

export const MONO = "'SF Mono', Menlo, Monaco, 'Roboto Mono', monospace";

export const Terminal = ({
  width,
  height,
  title,
  children,
  style,
}: {
  width: number;
  height: number;
  title: string;
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <div
    style={{
      width,
      height,
      borderRadius: 18,
      overflow: 'hidden',
      background: 'rgba(12,12,18,0.92)',
      border: '1px solid rgba(255,255,255,0.14)',
      boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 0 1px ${LAVENDER}22`,
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}
  >
    <div
      style={{
        height: 46,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '0 18px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span style={{ width: 13, height: 13, borderRadius: 999, background: '#ff5f57' }} />
      <span style={{ width: 13, height: 13, borderRadius: 999, background: '#febc2e' }} />
      <span style={{ width: 13, height: 13, borderRadius: 999, background: '#28c840' }} />
      <span style={{ marginLeft: 'auto', marginRight: 'auto', color: '#8a8ca6', fontFamily: MONO, fontSize: 17 }}>
        {title}
      </span>
    </div>
    <div style={{ flex: 1, padding: '22px 26px', fontFamily: MONO, fontSize: 22, lineHeight: 1.6, color: '#d8daf0' }}>
      {children}
    </div>
  </div>
);
