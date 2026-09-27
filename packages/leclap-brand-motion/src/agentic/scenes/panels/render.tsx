import { OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, PINK, YELLOW } from '../../../brand';
import { OSWALD } from '../../../fonts';
import { BRAND_TEXT, CLAMP, MonitorStandby, Sparks } from '../../../film/cinema';
import { MONO } from '../../../film/devices';
import { type Bilingual, useLang, useT } from '../../../film/lang';
import { COPY, EVIDENCE_COPY } from '../../copy';
import { EVIDENCE } from '../../pr';
import { FPS } from '../../timeline';

// Step 3 · Render: the before/after template gets its values, `validate_template` passes, then the
// engine composes — the monitor scrubs through the real render (public/captures/pr-evidence.mp4, or the
// French one) as the section timeline fills: intro, BEFORE, AFTER, what to review. The keys stay as the
// template names them; the values are the evidence's own, in the film's language.

const VARIABLES = Object.entries(EVIDENCE_COPY.fields);

/** The render's sections in seconds (read off the render): intro, BEFORE, AFTER, review. */
const SECTIONS: readonly (readonly [Bilingual, number, string])[] = [
  [COPY.loop.sections.intro, 1.33, LAVENDER],
  [COPY.loop.sections.before, 3.8, '#ff5f6d'],
  [COPY.loop.sections.after, 3.3, '#34d399'],
  [COPY.loop.sections.review, 2.4, YELLOW],
];
const TOTAL = SECTIONS.reduce((sum, [, seconds]) => sum + seconds, 0);

export const RenderPanel = ({
  at,
  valid,
  composeFrom,
  composed,
}: {
  at: number;
  valid: number;
  composeFrom: number;
  composed: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const card = spring({ frame: frame - at, fps, config: { damping: 16 } });

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 330,
          width: 830,
          height: 590,
          borderRadius: 18,
          background: 'rgba(14,14,22,0.94)',
          border: `1px solid ${LAVENDER}44`,
          boxShadow: '0 40px 90px rgba(0,0,0,0.6)',
          padding: '18px 26px',
          fontFamily: MONO,
          fontSize: 21,
          lineHeight: 1.62,
          whiteSpace: 'pre',
          opacity: card,
          transform: `translateY(${(1 - card) * 40}px)`,
        }}
      >
        <div style={{ fontFamily: OSWALD, fontSize: 19, letterSpacing: 3, color: '#8a8ca6', marginBottom: 8 }}>
          BEFORE-AFTER.JSON
        </div>
        <div style={{ color: '#8a8ca6' }}>{'{ "global": { "variables": {'}</div>
        {VARIABLES.map(([key, value], index) => (
          <Variable key={key} name={key} value={t(value)} from={at + 12 + index * 12} />
        ))}
        <div style={{ color: '#8a8ca6' }}>{'  } },'}</div>
        <div>
          <span style={{ color: LAVENDER }}>{'  "sections"'}</span>
          <span style={{ color: '#8a8ca6' }}>: [ intro, </span>
          <span style={{ color: '#ff8a95' }}>before</span>
          <span style={{ color: '#8a8ca6' }}>, </span>
          <span style={{ color: '#7ee2a8' }}>after</span>
          <span style={{ color: '#8a8ca6' }}>, review ] {'}'}</span>
        </div>
        <ValidateCall start={valid - 20} done={valid} />
      </div>

      <Monitor composeFrom={composeFrom} composed={composed} />
      <Sparks at={composed} x={0.66} y={0.84} count={16} spread={180} seed="agentic-composed" />
    </>
  );
};

const Variable = ({ name, value, from }: { name: string; value: string; from: number }) => {
  const frame = useCurrentFrame();
  const typed = Math.round(interpolate(frame, [from, from + 14], [0, value.length], CLAMP));

  return (
    <div>
      <span style={{ color: LAVENDER }}>{`    "${name}"`}</span>
      <span style={{ color: '#8a8ca6' }}>: </span>
      <span style={{ color: PINK }}>{`"${value.slice(0, typed)}"`}</span>
    </div>
  );
};

/** The MCP tool call, then the green stamp. */
const ValidateCall = ({ start, done }: { start: number; done: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const show = interpolate(frame, [start, start + 6], [0, 1], CLAMP);
  const stamp = spring({ frame: frame - done, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });

  return (
    <div
      style={{
        position: 'absolute',
        left: 26,
        right: 26,
        bottom: 20,
        opacity: show,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <span style={{ color: LAVENDER, fontWeight: 700 }}>mcp ▸</span>
      <span>validate_template</span>
      {frame >= done && (
        <span
          style={{
            marginLeft: 'auto',
            padding: '4px 14px',
            borderRadius: 10,
            background: '#7ee2a8',
            color: '#0b2a1a',
            fontFamily: OSWALD,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2,
            transform: `scale(${0.6 + stamp * 0.4}) rotate(${(1 - stamp) * -8}deg)`,
          }}
        >
          {t(COPY.loop.valid)}
        </span>
      )}
    </div>
  );
};

const MONITOR_W = 840;

const monitorLabel = (t: (s: Bilingual) => string, frame: number, composeFrom: number, progress: number): string => {
  if (frame < composeFrom) return t(COPY.loop.idle);

  if (progress >= 1) return t(COPY.loop.composed);

  return `${t(COPY.loop.composing)} ${Math.round(progress * 100)}%`;
};

/** The engine at work: a program monitor scrubbing the render, the section timeline, the output file. */
const Monitor = ({ composeFrom, composed }: { composeFrom: number; composed: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const lang = useLang();
  const height = (MONITOR_W * 9) / 16;
  const progress = interpolate(frame, [composeFrom, composed], [0, 1], CLAMP);
  const rate = TOTAL / ((composed - composeFrom) / FPS);
  const out = spring({ frame: frame - composed, fps, config: { damping: 12, stiffness: 180 } });

  return (
    <div style={{ position: 'absolute', left: 990, top: 330, width: MONITOR_W }}>
      <div
        style={{
          position: 'relative',
          width: MONITOR_W,
          height,
          borderRadius: 18,
          overflow: 'hidden',
          background: '#000',
          border: '1px solid rgba(255,255,255,0.16)',
          boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 ${progress > 0 && progress < 1 ? 60 : 0}px ${PINK}55`,
        }}
      >
        {frame < composeFrom && <MonitorStandby label={t(COPY.loop.waiting)} />}
        <Sequence from={composeFrom} layout="none">
          <OffthreadVideo
            src={staticFile(EVIDENCE[lang])}
            playbackRate={rate}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Sequence>
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 16,
            padding: '4px 12px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.6)',
            fontFamily: OSWALD,
            fontSize: 16,
            letterSpacing: 3,
            color: '#fff',
          }}
        >
          {monitorLabel(t, frame, composeFrom, progress)}
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', gap: 6, marginTop: 18, height: 42 }}>
        {SECTIONS.map(([label, seconds, color], index) => {
          const startAt = SECTIONS.slice(0, index).reduce((sum, [, s]) => sum + s, 0) / TOTAL;
          const fill = interpolate(progress, [startAt, startAt + seconds / TOTAL], [0, 1], CLAMP);

          return (
            <div
              key={label.en}
              style={{
                position: 'relative',
                flex: seconds,
                borderRadius: 8,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, width: `${fill * 100}%`, background: `${color}55` }} />
              <div
                style={{
                  position: 'relative',
                  fontFamily: OSWALD,
                  fontSize: 17,
                  letterSpacing: 2,
                  color: fill > 0 ? '#fff' : '#6b6d88',
                  padding: '9px 10px',
                }}
              >
                {t(label)}
              </div>
            </div>
          );
        })}
        <div
          style={{
            position: 'absolute',
            top: -6,
            bottom: -6,
            left: `${progress * 100}%`,
            width: 3,
            background: '#fff',
            borderRadius: 2,
            opacity: progress > 0 && progress < 1 ? 1 : 0,
          }}
        />
      </div>

      {frame >= composed && (
        <div
          style={{
            position: 'relative',
            marginTop: 22,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 18px',
            borderRadius: 12,
            background: 'rgba(126,226,168,0.1)',
            border: '1px solid rgba(126,226,168,0.45)',
            fontFamily: MONO,
            fontSize: 21,
            color: '#e6e7f7',
            transform: `scale(${0.8 + out * 0.2})`,
            opacity: out,
          }}
        >
          <span style={{ ...BRAND_TEXT, fontFamily: OSWALD, fontWeight: 700 }}>✓</span> build/pr-evidence.mp4 · 10.8 s ·
          1280×720
        </div>
      )}
    </div>
  );
};
