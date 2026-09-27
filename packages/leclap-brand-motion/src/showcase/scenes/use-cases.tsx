import { type ReactNode } from 'react';
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
import { BRAND_TEXT, CLAMP, Flash, FadeReveal, SceneShell } from '../../film/cinema';
import { type Bilingual, type PerLang, useLang, useT } from '../../film/lang';
import { COPY } from '../copy';

// 48–54s · What people make with it — four whip-cuts, one every three beats, each landing on a stab in
// the score and on the narrator's word. The first card is a match cut: the phone we just dove into is
// now a full-bleed story, the same footage, still playing. (The Present Yourself title cards in the last
// card stay English: they mirror that template's own output.)

const CARD = 45;

interface UseCase {
  n: string;
  /** One entry per line; the last line is set in the gradient. */
  title: PerLang<readonly string[]>;
  sub: Bilingual;
  /** Title size, when a language needs other than 150. */
  size?: PerLang<number>;
  visual: ReactNode;
}

const USE_CASES: readonly UseCase[] = [
  { n: '01', ...COPY.useCases.social, visual: <StoryVisual /> },
  { n: '02', ...COPY.useCases.brand, size: COPY.useCases.brandSize, visual: <BrandVisual /> },
  { n: '03', ...COPY.useCases.demos, visual: <DemoVisual /> },
  { n: '04', ...COPY.useCases.personalised, size: COPY.useCases.personalisedSize, visual: <NamesVisual /> },
];

export const UseCasesScene = () => (
  <AbsoluteFill style={{ background: '#0b0a14' }}>
    {USE_CASES.map((useCase, index) => (
      <Sequence
        key={useCase.n}
        from={index * CARD}
        durationInFrames={index === USE_CASES.length - 1 ? 180 - index * CARD : CARD}
      >
        <SceneShell enter={index === 0 ? 'punch' : 'whip'} exit={index === USE_CASES.length - 1 ? 'whip' : 'none'}>
          <Card useCase={useCase} />
        </SceneShell>
      </Sequence>
    ))}
    {/* the dive burned out to white; the story punches in out of it */}
    <Flash at={0} length={12} peak={1} />
  </AbsoluteFill>
);

const Card = ({ useCase }: { useCase: UseCase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const lang = useLang();
  const counter = spring({ frame: frame - 2, fps, config: { damping: 14 } });
  const lines = useCase.title[lang];

  return (
    <AbsoluteFill>
      {useCase.visual}
      {/* legibility scrim on the type side */}
      <AbsoluteFill
        style={{ background: 'linear-gradient(90deg, rgba(8,7,14,0.92) 0%, rgba(8,7,14,0.6) 42%, transparent 70%)' }}
      />

      <div style={{ position: 'absolute', left: 130, top: 330 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
            fontFamily: OSWALD,
            opacity: counter,
            transform: `translateY(${(1 - counter) * 20}px)`,
          }}
        >
          <span style={{ fontSize: 30, letterSpacing: 6, color: '#c9cbe0' }}>{t(COPY.useCases.label)}</span>
          <span style={{ fontSize: 30, fontWeight: 700, ...BRAND_TEXT }}>{useCase.n} / 04</span>
        </div>
        <div style={{ marginTop: 12 }}>
          {lines.map((line, index) => (
            <FadeReveal
              key={line}
              text={line}
              start={1 + index * 3}
              size={useCase.size?.[lang] ?? 150}
              gradient={index === lines.length - 1}
            />
          ))}
        </div>
        <div
          style={{
            marginTop: 16,
            fontFamily: OSWALD,
            fontWeight: 300,
            fontSize: 36,
            color: '#e0e1f5',
            opacity: interpolate(frame, [8, 16], [0, 1], CLAMP),
          }}
        >
          {t(useCase.sub)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * The phone's Present Yourself render, from the smile — where the dive through the screen lands. Starts at
 * 6.4s so its 1.5s window stays on her footage (the render's LeClap outro begins ~8.2s in).
 */
function RenderClip() {
  return (
    <OffthreadVideo
      src={staticFile('captures/present-yourself-render.mp4')}
      trimBefore={192}
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

/** A 9:16 story over a blurred copy of itself, with the story progress bars ticking. */
function StoryVisual() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const kenBurns = interpolate(frame, [0, durationInFrames], [1.15, 1.05]);
  const progress = interpolate(frame, [0, 45], [0.3, 0.75], CLAMP);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${kenBurns})`, filter: 'blur(28px) brightness(0.55) saturate(1.3)' }}>
        <RenderClip />
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          right: 300,
          top: 110,
          width: 470,
          height: 860,
          borderRadius: 34,
          overflow: 'hidden',
          boxShadow: `0 40px 100px rgba(0,0,0,0.6), 0 0 0 2px ${LAVENDER}66`,
        }}
      >
        <RenderClip />
        <div style={{ position: 'absolute', top: 18, left: 16, right: 16, display: 'flex', gap: 6 }}>
          {[1, progress, 0].map((fill, index) => (
            <div key={index} style={{ flex: 1, height: 5, borderRadius: 9, background: 'rgba(255,255,255,0.35)' }}>
              <div style={{ width: `${fill * 100}%`, height: '100%', borderRadius: 9, background: '#fff' }} />
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/**
 * A real brand intro made with LeClap for Kiln & Co. (the demo shop of the agentic beat): the engine renders
 * media/templates/kiln-brand-intro.json (media/render-use-cases.ts). At 1.5x from 1s in, its 1.5s window holds
 * the whole idea: the mug in the kiln's glow, the bloom to cream, the wordmark building letter by letter.
 */
function BrandVisual() {
  const t = useT();

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(900px 700px at 70% 50%, #d9774a40, transparent 70%)' }}>
      <div style={{ position: 'absolute', right: 150, top: 230, width: 1000 }}>
        <div
          style={{
            height: 562,
            borderRadius: 26,
            overflow: 'hidden',
            boxShadow: `0 40px 100px rgba(0,0,0,0.6), 0 0 0 2px ${PINK}55`,
          }}
        >
          <OffthreadVideo
            src={staticFile('captures/usecase-brand-intro.mp4')}
            trimBefore={30}
            playbackRate={1.5}
            muted
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
        <TemplateCaption>{t(COPY.useCases.brandCaption)}</TemplateCaption>
      </div>
    </AbsoluteFill>
  );
}

/**
 * A real product demo made with LeClap: the Kiln & Co. shop walkthrough (pick a glaze, add to cart, check
 * out), framed and titled by media/templates/kiln-product-demo.json. Cut in on "Add to cart": the click, the
 * confirmation and the cart drawer sliding in.
 */
function DemoVisual() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const tilt = interpolate(frame, [0, 45], [-12, -6]);

  return (
    <AbsoluteFill
      style={{ perspective: 1600, background: 'radial-gradient(900px 700px at 70% 50%, #9dbf9a33, transparent 70%)' }}
    >
      <div
        style={{
          position: 'absolute',
          right: 230,
          top: 150,
          transform: `rotateY(${tilt}deg) scale(${0.9 + enter * 0.1})`,
        }}
      >
        <div
          style={{
            width: 700,
            height: 700,
            borderRadius: 28,
            overflow: 'hidden',
            boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 2px rgba(157,191,154,0.5)',
          }}
        >
          <OffthreadVideo
            src={staticFile('captures/usecase-product-demo.mp4')}
            trimBefore={51}
            playbackRate={1.25}
            muted
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
        <TemplateCaption>{t(COPY.useCases.demoCaption)}</TemplateCaption>
      </div>
    </AbsoluteFill>
  );
}

/** The template a use-case render came from, under its frame. */
function TemplateCaption({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 16,
        textAlign: 'center',
        fontFamily: "'SF Mono', Menlo, monospace",
        fontSize: 20,
        color: '#b9bbd6',
      }}
    >
      {children}
    </div>
  );
}

/** The same template, three names: Present Yourself title cards fan out like a deck — one render each. */
function NamesVisual() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const names = ['Alex', 'Sam', 'Noor'];
  const caption = spring({ frame: frame - 16, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(900px 700px at 70% 50%, ${LAVENDER}3a, transparent 70%)` }}>
      {names.map((name, index) => {
        const fan = spring({ frame: frame - index * 5, fps, config: { damping: 13, stiffness: 140 } });
        const offset = index - 1;

        return (
          <div
            key={name}
            style={{
              position: 'absolute',
              left: 1390 + offset * 185 - 150,
              top: 250 + Math.abs(offset) * 30,
              width: 300,
              height: 533,
              borderRadius: 22,
              overflow: 'hidden',
              background: 'linear-gradient(180deg, #13243f, #0d1b2a)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.14)',
              transform: `rotate(${offset * 8 * fan}deg) translateY(${(1 - fan) * 260}px)`,
              transformOrigin: '50% 120%',
              opacity: fan,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: OSWALD,
            }}
          >
            <div style={{ fontSize: 17, letterSpacing: 3, fontWeight: 600, color: LAVENDER }}>PRESENTING</div>
            <div style={{ fontSize: 74, fontWeight: 700, color: '#fff', lineHeight: 1.05 }}>{name}</div>
            <div style={{ width: 56, height: 3, background: LAVENDER, borderRadius: 9, margin: '6px 0 8px' }} />
            <div style={{ fontSize: 14, fontWeight: 300, color: '#9aa3b8' }}>shot & rendered on this device</div>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 1390 - 300,
          width: 600,
          top: 870,
          textAlign: 'center',
          fontFamily: "'SF Mono', Menlo, monospace",
          fontSize: 20,
          color: '#b9bbd6',
          opacity: caption,
        }}
      >
        --field form_1_firstname=Alex · Sam · Noor
      </div>
    </AbsoluteFill>
  );
}
