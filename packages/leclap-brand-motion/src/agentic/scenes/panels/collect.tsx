import { OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, YELLOW } from '../../../brand';
import { OSWALD } from '../../../fonts';
import { CLAMP } from '../../../film/cinema';
import { BrowserWindow, MONO } from '../../../film/devices';
import { useLang, useT } from '../../../film/lang';
import { COPY, EVIDENCE_COPY } from '../../copy';

// Step 2 · Collect evidence: the same walkthrough recorded on the base branch and on the change's
// branch (the demo shop's before/after — examples/agentic-pr-video/demo-shop), side by side, REC lit,
// and the one explicit review focus typed underneath — the value the evidence's review card shows.

const WINDOW_W = 850;

export const CollectPanel = ({ at }: { at: number }) => {
  const frame = useCurrentFrame() - at;
  const { fps } = useVideoConfig();
  const t = useT();
  const lang = useLang();
  const focus = t(EVIDENCE_COPY.fields.reviewFocus);
  const typed = Math.round(interpolate(frame, [70, 110], [0, focus.length], CLAMP));
  const note = spring({ frame: frame - 62, fps, config: { damping: 16 } });

  return (
    <>
      <Recording
        at={at}
        left={80}
        label={t(COPY.loop.before)}
        branch="main"
        color="#ff5f6d"
        src="captures/kiln-shop/before.mp4"
        delay={0}
      />
      <Recording
        at={at}
        left={990}
        label={t(COPY.loop.after)}
        branch="fix/add-to-cart"
        color="#34d399"
        src="captures/kiln-shop/after.mp4"
        delay={6}
      />

      <div
        style={{
          position: 'absolute',
          left: 600,
          top: 900,
          width: 720,
          padding: '14px 24px',
          borderRadius: 14,
          background: 'rgba(255,246,133,0.08)',
          border: '1px solid rgba(255,246,133,0.35)',
          fontFamily: MONO,
          fontSize: COPY.loop.focusSize[lang],
          color: '#e6e7f7',
          opacity: note,
          transform: `translateY(${(1 - note) * 20}px)`,
          whiteSpace: 'pre',
        }}
      >
        <span style={{ color: YELLOW }}>reviewFocus</span>: “{focus.slice(0, typed)}”
      </div>
    </>
  );
};

const Recording = ({
  at,
  left,
  label,
  branch,
  color,
  src,
  delay,
}: {
  at: number;
  left: number;
  label: string;
  branch: string;
  color: string;
  src: string;
  delay: number;
}) => {
  const frame = useCurrentFrame() - at;
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 15 } });
  const seconds = Math.max(0, Math.floor((frame - 10) / fps));
  const blink = Math.floor(frame / 12) % 2 === 0;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: 330,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 50}px) scale(${0.94 + enter * 0.06})`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12, fontFamily: OSWALD }}>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 3, color, textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 20, color: '#8a8ca6' }}>{branch}</span>
      </div>
      <BrowserWindow width={WINDOW_W} address="kiln.co/products/speckled-mug">
        <div style={{ position: 'relative', height: (WINDOW_W * 9) / 16 }}>
          <Sequence from={at + 10} layout="none">
            <OffthreadVideo src={staticFile(src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Sequence>
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 12px',
              borderRadius: 999,
              background: 'rgba(10,10,16,0.72)',
              fontFamily: MONO,
              fontSize: 16,
              color: '#fff',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 9, background: '#ff3653', opacity: blink ? 1 : 0.3 }} />
            REC 00:0{seconds}
          </div>
          <div
            style={{
              position: 'absolute',
              right: 14,
              top: 14,
              padding: '5px 12px',
              borderRadius: 999,
              background: `${LAVENDER}cc`,
              fontFamily: MONO,
              fontSize: 15,
              color: '#fff',
            }}
          >
            playwright
          </div>
        </div>
      </BrowserWindow>
    </div>
  );
};
