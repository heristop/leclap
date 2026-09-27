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
import { LAVENDER, PINK, YELLOW } from '../../brand';
import { OSWALD } from '../../fonts';
import {
  CLAMP,
  DriftGlow,
  EASE,
  Kicker,
  KineticWords,
  FadeReveal,
  SceneShell,
  Sparks,
  easeOutExpo,
} from '../../film/cinema';
import { ClapBody, useBlink, useClap, useHop } from '../../film/acting';
import { Clappy, type ClappyMood } from '../../film/clappy';
import { MONO, Terminal } from '../../film/devices';
import { useLang, useT } from '../../film/lang';
import { SquintGauge } from '../../film/squint-gauge';
import { EVIDENCE } from '../../agentic/pr';
import { COPY, TIMING } from '../copy';
import { AGENTIC, CLAPS, FPS, HITS, sceneById } from '../timeline';

// 54–70s · Agentic development, on a (fake) project you can read at a glance: the Kiln & Co. shop,
// where "Add to cart" was a faint link. The agent's log types out — implement, record the before and
// after walkthroughs, validate the before/after template, compose, attach — and the pull request fills
// in. The evidence (public/captures/pr-evidence.mp4, rendered by the engine from
// examples/agentic-pr-video/before-after.json) drops into the PR, then flies out and takes the frame:
// BEFORE, a wipe, AFTER — the narrator says each, and the reviewer's squint-o-meter falls out of the red
// on the wipe. On the line — "Don't describe the change. Show it." — everything falls back; Clappy claps
// us into the finale.
//
// Claim boundary (PRODUCT.md): LeClap renders the artifact; the agent's workflow attaches it.
//
// The agent's log and the pull request's title and body stay English in every language (they're what the
// agent wrote); the evidence is the render for the film's language (EVIDENCE, shared with the agentic film).

const start = sceneById('agentic').from;
const at = (seconds: number): number => Math.round((seconds - start) * FPS);

const ATTACH = at(AGENTIC.attach);
const EXPAND = ATTACH + 12;
const EXPANDED = EXPAND + 18;
const WIPE = at(AGENTIC.wipe);
const PROOF = at(HITS.proof);
const SLAM = at(CLAPS[2]);

interface LogLine {
  at: number;
  done: number;
  who: 'agent' | 'mcp';
  text: string;
  result?: string;
}

const LOG: readonly LogLine[] = [
  { at: 8, done: 22, who: 'agent', text: 'implement  primary button + cart drawer' },
  { at: 24, done: 42, who: 'agent', text: 'record     before.mp4 · after.mp4' },
  { at: 46, done: 62, who: 'mcp', text: 'validate_template  before-after.json', result: '✓ valid — 4 sections' },
  { at: 66, done: 120, who: 'mcp', text: 'compose_video', result: '→ build/pr-evidence.mp4' },
  { at: 124, done: ATTACH, who: 'agent', text: 'attach to pull request #482' },
];

const PIPELINE = COPY.agentic.pipeline;
const STEP_AT = [8, 24, 46, 66, 124] as const;

export const AgenticScene = () => (
  <SceneShell enter="whip" exit="zoom" exitOrigin="84% 72%" exitFrames={10}>
    <AgenticBody />
  </SceneShell>
);

const AgenticBody = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const behind = interpolate(frame, [EXPAND, EXPANDED], [0, 1], { ...CLAMP, easing: EASE.inOutCubic });
  const kicker = spring({ frame: frame - 2, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ background: '#0b0a14' }}>
      <DriftGlow hueA={LAVENDER} hueB={PINK} />

      {/* the working layer — steps back when the evidence takes the frame */}
      <AbsoluteFill
        style={{
          transform: `scale(${1 - behind * 0.08})`,
          filter: `blur(${behind * 8}px) brightness(${1 - behind * 0.6})`,
        }}
      >
        <div style={{ position: 'absolute', left: 110, top: 96 }}>
          <Kicker appear={kicker}>{t(COPY.agentic.kicker)}</Kicker>
        </div>

        <AbsoluteFill style={{ perspective: 1800 }}>
          <div
            style={{ position: 'absolute', left: 110, top: 200, transform: 'rotateY(9deg)', transformOrigin: '0% 50%' }}
          >
            <AgentLog />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 1010,
              top: 175,
              transform: 'rotateY(-9deg)',
              transformOrigin: '100% 50%',
            }}
          >
            <PullRequest />
          </div>
        </AbsoluteFill>

        <Pipeline />
      </AbsoluteFill>

      <EvidencePlayer />
      <SquintOMeter />
      <ProofHeadline />
    </AbsoluteFill>
  );
};

// ─── the agent's log ────────────────────────────────────────────────────────────────────────────

const AgentLog = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16 } });

  return (
    <div style={{ opacity: enter, transform: `translateX(${(1 - enter) * -200}px)` }}>
      <Terminal width={850} height={600} title="agent · kiln-co/shop · leclap mcp">
        {LOG.map((line) => (
          <LogRow key={line.text} line={line} />
        ))}
        <Cursor />
      </Terminal>
    </div>
  );
};

const LogRow = ({ line }: { line: LogLine }) => {
  const frame = useCurrentFrame();

  if (frame < line.at) return null;

  const typed = Math.round(interpolate(frame, [line.at, line.at + 9], [0, line.text.length], CLAMP));
  const done = frame >= line.done;
  const composing = line.text === 'compose_video' && !done;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 14, whiteSpace: 'pre' }}>
        <span style={{ color: line.who === 'agent' ? PINK : LAVENDER, fontWeight: 700 }}>{line.who.padEnd(5)}</span>
        <span style={{ color: '#6b6d88' }}>▸</span>
        <span>{line.text.slice(0, typed)}</span>
        {done && <span style={{ marginLeft: 'auto', color: '#7ee2a8', fontWeight: 700 }}>✓</span>}
      </div>
      {composing && <ComposeBar from={line.at + 6} to={line.done} />}
      {done && line.result && <div style={{ paddingLeft: 118, color: YELLOW, whiteSpace: 'pre' }}>{line.result}</div>}
    </div>
  );
};

const ComposeBar = ({ from, to }: { from: number; to: number }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [from, to - 4], [0, 1], CLAMP);
  const cells = 22;
  const filled = Math.round(progress * cells);

  return (
    <div style={{ paddingLeft: 118, whiteSpace: 'pre', color: '#c9cbe0' }}>
      <span style={{ color: LAVENDER }}>{'█'.repeat(filled)}</span>
      <span style={{ color: '#34354a' }}>{'█'.repeat(cells - filled)}</span>
      {`  ${Math.round(progress * 100)}%`}
    </div>
  );
};

const Cursor = () => {
  const frame = useCurrentFrame();

  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 26,
        background: YELLOW,
        opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0,
        marginTop: 6,
      }}
    />
  );
};

// ─── the pull request ───────────────────────────────────────────────────────────────────────────

const PullRequest = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const lang = useLang();
  const [conversation, commits, files] = COPY.agentic.tabs;
  const enter = spring({ frame: frame - 8, fps, config: { damping: 16 } });
  const ready = frame >= ATTACH;
  const drop = spring({ frame: frame - ATTACH, fps, config: { damping: 11, stiffness: 150, mass: 0.7 } });

  return (
    <div
      style={{
        width: 800,
        height: 660,
        borderRadius: 22,
        background: 'linear-gradient(170deg, #1a1928, #111019)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 40px 90px rgba(0,0,0,0.6)',
        padding: '26px 30px',
        opacity: enter,
        transform: `translateX(${(1 - enter) * 200}px)`,
        fontFamily: OSWALD,
        position: 'relative',
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 17, color: '#8a8ca6' }}>kiln-co / shop · pull request #482</div>
      <div style={{ marginTop: 8, fontSize: 36, fontWeight: 700, color: '#fff' }}>
        fix(product): make Add to cart obvious
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          marginTop: 14,
          fontSize: 21,
          color: '#8a8ca6',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 10,
        }}
      >
        <span style={{ color: '#fff', borderBottom: `3px solid ${PINK}`, paddingBottom: 8 }}>{t(conversation)}</span>
        <span>{t(commits)}</span>
        <span>{t(files)}</span>
        <span
          style={{
            marginLeft: 'auto',
            padding: '5px 14px',
            borderRadius: 999,
            fontSize: 18,
            letterSpacing: 2,
            color: ready ? '#0b2a1a' : '#c9cbe0',
            background: ready ? '#7ee2a8' : 'rgba(255,255,255,0.1)',
            transform: `scale(${ready ? 1 + (1 - drop) * 0.3 : 1})`,
          }}
        >
          {t(ready ? COPY.agentic.ready : COPY.agentic.draft)}
        </span>
      </div>
      <div style={{ marginTop: 16, fontSize: 23, fontWeight: 300, color: '#d8daf0', lineHeight: 1.35 }}>
        Replaces the faint “add to cart” link with a primary button, and opens a cart drawer on add.
        <br />
        <span style={{ color: PINK, fontWeight: 500 }}>Review focus:</span> button contrast and drawer focus.
      </div>

      <div style={{ marginTop: 18, position: 'relative', width: 560, height: 315 }}>
        {!ready && <PendingSlot />}
        {ready && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 16,
              overflow: 'hidden',
              transform: `translateY(${(1 - drop) * -90}px) scale(${0.85 + drop * 0.15})`,
              opacity: Math.min(1, drop * 2),
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 2px ${LAVENDER}88`,
            }}
          >
            <Sequence from={ATTACH} layout="none">
              <OffthreadVideo
                src={staticFile(EVIDENCE[lang])}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Sequence>
          </div>
        )}
        <Sparks at={ATTACH} count={20} spread={260} seed="attach" box={{ width: 560, height: 315 }} />
      </div>
      {ready && (
        <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 17, color: '#8a8ca6', opacity: drop }}>
          {t(COPY.agentic.attachment)}
        </div>
      )}
    </div>
  );
};

const PendingSlot = () => {
  const frame = useCurrentFrame();
  const t = useT();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 16,
        border: '2px dashed rgba(255,255,255,0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        color: '#6b6d88',
        fontSize: 24,
        letterSpacing: 3,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: '50%',
          border: '4px solid rgba(255,255,255,0.12)',
          borderTopColor: LAVENDER,
          transform: `rotate(${frame * 12}deg)`,
        }}
      />
      {t(COPY.agentic.pending)}
    </div>
  );
};

// ─── the evidence, full frame ───────────────────────────────────────────────────────────────────

/** Where the PR's evidence slot sits on screen (the flight starts there), and the full-frame player. */
const SLOT = { x: 1370, y: 640, w: 560 };
const BIG = { x: 960, y: 548, w: 1344 };

/** The evidence flies out of the pull request and takes the frame; it falls back as the line lands. */
const EvidencePlayer = () => {
  const frame = useCurrentFrame();
  const t = useT();
  const lang = useLang();
  const fly = interpolate(frame, [EXPAND, EXPANDED], [0, 1], { ...CLAMP, easing: EASE.inOutCubic });
  const recede = interpolate(frame, [PROOF - 2, PROOF + 12], [0, 1], { ...CLAMP, easing: EASE.outCubic });

  if (frame < EXPAND) return null;

  const width = interpolate(fly, [0, 1], [SLOT.w, BIG.w]);
  const cx = interpolate(fly, [0, 1], [SLOT.x, BIG.x]);
  const cy = interpolate(fly, [0, 1], [SLOT.y, BIG.y]);
  const height = (width * 9) / 16;

  return (
    <AbsoluteFill
      style={{ opacity: 1 - recede * 0.75, filter: `blur(${recede * 8}px)`, transform: `scale(${1 - recede * 0.18})` }}
    >
      <div
        style={{
          position: 'absolute',
          left: cx - width / 2,
          top: cy - height / 2,
          width,
          height,
          borderRadius: interpolate(fly, [0, 1], [16, 24]),
          overflow: 'hidden',
          boxShadow: `0 40px 120px rgba(0,0,0,0.7), 0 0 0 2px ${LAVENDER}aa`,
        }}
      >
        <Sequence from={ATTACH} layout="none">
          <OffthreadVideo
            src={staticFile(EVIDENCE[lang])}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Sequence>
      </div>
      <div
        style={{
          position: 'absolute',
          left: BIG.x - BIG.w / 2,
          top: BIG.y - (BIG.w * 9) / 32 - 44,
          fontFamily: MONO,
          fontSize: 20,
          color: '#b9bbd6',
          opacity: fly,
        }}
      >
        {t(COPY.agentic.player)}
      </div>
    </AbsoluteFill>
  );
};

/** The gag: the reviewer squints through BEFORE; on the wipe to AFTER the needle falls out of the red. */
const SquintOMeter = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const appear = interpolate(frame, [EXPANDED - 4, EXPANDED + 8, PROOF - 2, PROOF + 8], [0, 1, 1, 0], CLAMP);
  const relief =
    frame < WIPE + 10 ? 0 : spring({ frame: frame - WIPE - 10, fps, config: { damping: 6, stiffness: 90, mass: 0.8 } });

  if (appear <= 0) return null;

  return (
    <div style={{ position: 'absolute', right: 26, bottom: 150, opacity: appear }}>
      <SquintGauge relief={relief} label={t(COPY.agentic.squint)} />
    </div>
  );
};

// ─── pipeline ───────────────────────────────────────────────────────────────────────────────────

const Pipeline = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const enter = spring({ frame: frame - 10, fps, config: { damping: 16 } });
  const active = STEP_AT.reduce((acc, stepAt, index) => (frame >= stepAt ? index : acc), -1);
  const progress = interpolate(frame, [...STEP_AT, ATTACH], [0, 0.25, 0.5, 0.75, 0.95, 1], CLAMP);
  const span = 1520;

  return (
    <div
      style={{
        position: 'absolute',
        left: 200,
        top: 890,
        width: span,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 40}px)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 17,
          height: 4,
          borderRadius: 9,
          background: 'rgba(255,255,255,0.1)',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            borderRadius: 9,
            background: `linear-gradient(90deg, ${LAVENDER}, ${PINK})`,
            boxShadow: `0 0 16px ${PINK}`,
          }}
        />
      </div>
      {PIPELINE.map((label, index) => {
        const x = (index / (PIPELINE.length - 1)) * span;
        const on = index <= active;

        return (
          <div key={label.en} style={{ position: 'absolute', left: x - 80, width: 160, textAlign: 'center' }}>
            <div
              style={{
                margin: '0 auto',
                width: 38,
                height: 38,
                borderRadius: 999,
                background: on ? `linear-gradient(135deg, ${LAVENDER}, ${PINK})` : '#1c1b2b',
                border: `2px solid ${on ? '#fff' : 'rgba(255,255,255,0.15)'}`,
                boxShadow: index === active ? `0 0 26px ${PINK}` : 'none',
                transform: `scale(${index === active ? 1.15 : 1})`,
              }}
            />
            <div
              style={{
                marginTop: 10,
                fontFamily: OSWALD,
                fontSize: 24,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: on ? '#fff' : '#5c5e78',
              }}
            >
              {t(label)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── the line ───────────────────────────────────────────────────────────────────────────────────

const ProofHeadline = () => {
  const frame = useCurrentFrame();
  const t = useT();
  const lang = useLang();
  const hop = useHop(PROOF + 12, 80, 13);
  const { angle, impact } = useClap(SLAM);
  const blink = useBlink(30);
  const windUp = interpolate(frame, [SLAM - 14, SLAM - 5, SLAM], [0, 1, 0.2], CLAMP);
  const enter = interpolate(frame, [PROOF + 6, PROOF + 18], [0, 1], { ...CLAMP, easing: easeOutExpo });

  if (frame < PROOF - 2) return null;

  const raise = frame > PROOF + 28 && frame < SLAM - 14 ? 150 + Math.sin(frame / 4) * 10 : 30;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Headroom />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: -40 }}>
        <KineticWords text={t(COPY.agentic.dontDescribe)} start={PROOF} size={110} />
        <div style={{ marginTop: 8 }}>
          {/* lands with the narrator's "Show it." / "Montrez-le." (copy.ts → TIMING) */}
          <KineticWords
            text={t(COPY.agentic.showIt)}
            start={TIMING.showIt[lang]}
            size={COPY.agentic.showItSize[lang]}
            gradientWords={COPY.agentic.showItGradient[lang]}
          />
        </div>
        <div style={{ marginTop: 26 }}>
          <FadeReveal
            text={t(COPY.agentic.claim)}
            start={PROOF + 18}
            size={34}
            weight={400}
            tracking={0.06}
            color="#d8daf0"
          />
        </div>
      </div>

      <div style={{ position: 'absolute', right: 150, bottom: 110, opacity: enter }}>
        <ClapBody
          y={hop.y + (1 - enter) * 300}
          sx={hop.sx + impact * 0.12 + windUp * 0.06}
          sy={hop.sy - impact * 0.14 - windUp * 0.08}
          rotate={-6 + impact * 5}
        >
          <Clappy
            size={230}
            angle={angle}
            lookX={-0.9}
            lookY={-0.4}
            blink={blink}
            mood={proofMood(frame)}
            armL={windUp > 0 ? 30 + windUp * 135 : raise}
            armR={windUp > 0 ? 30 + windUp * 135 : 30 + Math.sin(frame / 6) * 6}
          />
        </ClapBody>
      </div>
    </AbsoluteFill>
  );
};

/** Grinning, a wink at camera mid-way, focused for the final clap. */
const proofMood = (frame: number): ClappyMood => {
  if (frame > SLAM - 14) return 'focused';

  if (frame > PROOF + 40 && frame < PROOF + 54) return 'wink';

  return 'grin';
};

/** The brand-coloured glow that swells behind the headline as it lands. */
const Headroom = () => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [PROOF, PROOF + 10, PROOF + 60], [0, 1, 0.5], CLAMP);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(900px 420px at 50% 45%, ${LAVENDER}${Math.round(glow * 80)
          .toString(16)
          .padStart(2, '0')}, transparent 70%)`,
      }}
    />
  );
};
