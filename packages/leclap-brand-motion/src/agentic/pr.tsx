import { AbsoluteFill, Freeze, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAVENDER, PINK } from '../brand';
import { OSWALD } from '../fonts';
import { Sparks } from '../film/cinema';
import { MONO } from '../film/devices';
import { type PerLang, useLang, useT } from '../film/lang';
import { COPY } from './copy';
import { EVIDENCE_POSTER, FPS } from './timeline';

// The pull request, drawn two ways: drowning in prose (the hook), and with the evidence attached (the
// loop's last step, then the review's backdrop). The evidence slot sits at a fixed spot on screen
// (SLOT) so the review can grow the player out of exactly that rectangle. Its title and body stay English
// in every language — they're what the agent wrote; the chrome around them follows the film's language.

/** The evidence render per language (media/render-pr-evidence.ts [--lang fr]) — the showcase plays it too. */
export const EVIDENCE: PerLang<string> = { en: 'captures/pr-evidence.mp4', fr: 'captures/pr-evidence.fr.mp4' };

/** The evidence slot on screen: centre and width (16:9). */
export const SLOT = { x: 1130, y: 700, w: 720 } as const;

const CARD = { left: 600, top: 170, width: 1060 } as const;

const PrHeader = ({ ready, readyPop }: { ready: boolean; readyPop: number }) => {
  const t = useT();
  const [conversation, commits, files] = COPY.pr.tabs;

  return (
    <>
      <div style={{ fontFamily: MONO, fontSize: 19, color: '#8a8ca6' }}>kiln-co / shop · pull request #482</div>
      <div style={{ marginTop: 8, fontSize: 42, fontWeight: 700, color: '#fff' }}>
        fix(product): make Add to cart obvious
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 30,
          marginTop: 14,
          fontSize: 23,
          color: '#8a8ca6',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 12,
        }}
      >
        <span style={{ color: '#fff', borderBottom: `3px solid ${PINK}`, paddingBottom: 10 }}>{t(conversation)}</span>
        <span>{t(commits)}</span>
        <span>{t(files)}</span>
        <span
          style={{
            marginLeft: 'auto',
            padding: '6px 16px',
            borderRadius: 999,
            fontSize: 19,
            letterSpacing: 2,
            color: ready ? '#0b2a1a' : '#c9cbe0',
            background: ready ? '#7ee2a8' : 'rgba(255,255,255,0.1)',
            transform: `scale(${1 + (1 - readyPop) * 0.3})`,
          }}
        >
          {t(ready ? COPY.pr.ready : COPY.pr.draft)}
        </span>
      </div>
    </>
  );
};

const PROSE = [
  'Replaces the “add to cart” text link with a primary Button component.',
  'Adds a CartDrawer that opens on add, with focus trapped while it is open.',
  'The header badge animates on update and respects prefers-reduced-motion.',
  'Moves the shipping and returns copy below the call to action.',
  'Refactors AddToCart to own its added state; ProductPage passes the price.',
  'Updates button tokens: contrast 4.8:1 on the terracotta background.',
  'Checks: unit ✓ · e2e ✓ · visual —',
  'Screenshots: —',
  'Notes for review: please check the drawer on small screens, the focus',
  'order after adding, and that the badge count stays in sync with the cart.',
];

/** The PR as reviewers usually get it: a claim in prose, a diff, and no way to see the behavior. */
export const ProsePr = ({ scroll }: { scroll: number }) => (
  <div
    style={{
      width: 1180,
      height: 820,
      borderRadius: 24,
      overflow: 'hidden',
      background: 'linear-gradient(170deg, #1a1928, #111019)',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 50px 120px rgba(0,0,0,0.65)',
      padding: '30px 36px',
      fontFamily: OSWALD,
    }}
  >
    <PrHeader ready={false} readyPop={1} />
    <div style={{ height: 560, overflow: 'hidden', marginTop: 20 }}>
      <div style={{ transform: `translateY(${-scroll}px)` }}>
        {PROSE.map((line) => (
          <div key={line} style={{ fontSize: 27, fontWeight: 300, color: '#c9cbe0', lineHeight: 1.75 }}>
            {line}
          </div>
        ))}
        <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 21, color: '#8a8ca6' }}>
          14 files changed · <span style={{ color: '#7ee2a8' }}>+312</span>{' '}
          <span style={{ color: '#ff5f6d' }}>−87</span>
        </div>
      </div>
    </div>
  </div>
);

/** The evidence at its title card, frozen — what the PR shows before anyone presses play. */
export const EvidencePoster = () => {
  const lang = useLang();

  return (
    <Freeze frame={0}>
      <OffthreadVideo
        src={staticFile(EVIDENCE[lang])}
        trimBefore={Math.round(EVIDENCE_POSTER * FPS)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </Freeze>
  );
};

/**
 * The pull request with the evidence attached — full frame, the slot at SLOT. `dropFrame` is when the
 * video lands (a spinner before it); pass a negative frame for the settled state.
 */
export const AttachedPr = ({ dropFrame }: { dropFrame: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const dropped = frame >= dropFrame;
  const drop = spring({ frame: frame - dropFrame, fps, config: { damping: 11, stiffness: 150, mass: 0.7 } });
  const slotH = (SLOT.w * 9) / 16;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: CARD.left,
          top: CARD.top,
          width: CARD.width,
          height: 800,
          borderRadius: 24,
          background: 'linear-gradient(170deg, #1a1928, #111019)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 50px 120px rgba(0,0,0,0.6)',
          padding: '30px 36px',
          fontFamily: OSWALD,
        }}
      >
        <PrHeader ready={dropped} readyPop={dropped ? drop : 1} />
        <div style={{ marginTop: 16, fontSize: 25, fontWeight: 300, color: '#d8daf0', lineHeight: 1.4 }}>
          Replaces the faint “add to cart” link with a primary button, and opens a cart drawer on add.
          <br />
          <span style={{ color: PINK, fontWeight: 500 }}>Review focus:</span> button contrast and drawer focus.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: SLOT.x - SLOT.w / 2,
          top: SLOT.y - slotH / 2,
          width: SLOT.w,
          height: slotH,
        }}
      >
        {!dropped && <PendingSlot />}
        {dropped && (
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
            <EvidencePoster />
            <PlayButton />
          </div>
        )}
        <Sparks at={dropFrame} count={24} spread={300} seed="agentic-attach" box={{ width: SLOT.w, height: slotH }} />
        {dropped && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: slotH + 12,
              fontFamily: MONO,
              fontSize: 19,
              color: '#8a8ca6',
              opacity: drop,
            }}
          >
            {t(COPY.pr.attachment)}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// On the poster's empty right side: centred, it sat on the title card's headline.
const PlayButton = () => (
  <AbsoluteFill style={{ alignItems: 'flex-end', justifyContent: 'center', paddingRight: '17%' }}>
    <div
      style={{
        width: 76,
        height: 76,
        borderRadius: '50%',
        background: 'rgba(12,12,20,0.55)',
        border: '2px solid rgba(255,255,255,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={28} height={32} viewBox="0 0 36 40">
        <path d="M6 4 L32 20 L6 36 Z" fill="#fff" />
      </svg>
    </div>
  </AbsoluteFill>
);

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
        gap: 16,
        color: '#6b6d88',
        fontFamily: OSWALD,
        fontSize: 26,
        letterSpacing: 3,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: '4px solid rgba(255,255,255,0.12)',
          borderTopColor: LAVENDER,
          transform: `rotate(${frame * 12}deg)`,
        }}
      />
      {t(COPY.pr.pending)}
    </div>
  );
};
