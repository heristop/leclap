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
import { OSWALD } from './fonts';
import { LAVENDER, PINK, INK, BRAND_GRADIENT } from './brand';
import { Bumper } from './Bumper';

// The shared LeClap promo: a clapper bumper, then real screen-recording beats (mp4s in public/captures)
// shown in a browser frame with brand captions, closing on a CTA. Orientation-aware (landscape +
// portrait). Parameterized so each promo (template builder, studio creation, …) is a thin wrapper.

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export interface PromoShot {
  // The mp4 basename in public/captures (without extension).
  src: string;
  kicker: string;
  lines: readonly string[];
  sub: string;
}

const INTRO = 90; // 3s clapper bumper
const SHOT_DUR = 168; // ~5.6s per beat
const OVERLAP = 18; // cross-dissolve overlap between beats
const CTA_DUR = 150;

export interface PromoVideoProps {
  shots: readonly PromoShot[];
  bumperTagline: string;
  ctaHeadline: string;
  // The faux browser address pill shown on the frame (e.g. "leclap · /studio").
  addressLabel: string;
  wordmark?: string;
  url: string;
}

export const PromoVideo = ({
  shots,
  bumperTagline,
  ctaHeadline,
  addressLabel,
  wordmark = 'LeClap',
  url,
}: PromoVideoProps) => {
  const shotStart = (i: number): number => INTRO + i * (SHOT_DUR - OVERLAP);
  const ctaFrom = shotStart(shots.length);

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <DriftGlow />

      <Sequence durationInFrames={INTRO + 6}>
        <Bumper wordmark={wordmark} tagline={bumperTagline} />
      </Sequence>

      {shots.map((shot, i) => (
        <Sequence key={shot.src} from={shotStart(i)} durationInFrames={SHOT_DUR}>
          <Shot shot={shot} addressLabel={addressLabel} />
        </Sequence>
      ))}

      <Sequence from={ctaFrom} durationInFrames={CTA_DUR}>
        <Cta wordmark={wordmark} headline={ctaHeadline} url={url} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Two soft brand-colored radial glows that drift across the frame, so the dark backdrop never reads flat.
const DriftGlow = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [0.36, 0.64]);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(${width * 0.5}px ${height * 0.5}px at ${x * 100}% 34%, ${LAVENDER}33, transparent 70%),
            radial-gradient(${width * 0.5}px ${height * 0.5}px at ${(1 - x) * 100}% 96%, ${PINK}2e, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// One beat: caption above a browser frame holding the recording (the clip's own motion carries it),
// fading in/out at its edges so consecutive beats cross-dissolve.
const Shot = ({ shot, addressLabel }: { shot: PromoShot; addressLabel: string }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const portrait = height >= width;

  const appear = spring({ frame, fps, durationInFrames: 22, config: { damping: 16, mass: 0.7 } });
  const fade = interpolate(frame, [0, OVERLAP, SHOT_DUR - OVERLAP, SHOT_DUR], [0, 1, 1, 0], CLAMP);

  const frameW = portrait ? width * 0.86 : width * 0.5;
  const captionTop = portrait ? height * 0.09 : height * 0.075;
  const frameTop = portrait ? height * 0.4 : height * 0.4;

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Caption shot={shot} appear={appear} top={captionTop} portrait={portrait} />
      <BrowserFrame src={shot.src} appear={appear} width={frameW} top={frameTop} addressLabel={addressLabel} />
    </AbsoluteFill>
  );
};

const Caption = ({
  shot,
  appear,
  top,
  portrait,
}: {
  shot: PromoShot;
  appear: number;
  top: number;
  portrait: boolean;
}) => {
  const { width } = useVideoConfig();
  const rise = interpolate(appear, [0, 1], [28, 0]);
  const headline = portrait ? width * 0.072 : width * 0.044;
  const sub = portrait ? width * 0.03 : width * 0.019;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        width: '100%',
        textAlign: 'center',
        transform: `translateY(${rise}px)`,
        opacity: appear,
        fontFamily: OSWALD,
        padding: `0 ${width * 0.06}px`,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          fontSize: width * 0.013,
          letterSpacing: width * 0.004,
          fontWeight: 600,
          color: '#fff',
          background: BRAND_GRADIENT,
          padding: `${width * 0.004}px ${width * 0.014}px`,
          borderRadius: 999,
          marginBottom: width * 0.014,
        }}
      >
        {shot.kicker}
      </div>
      {shot.lines.map((line) => (
        <div key={line} style={{ fontSize: headline, fontWeight: 700, lineHeight: 1.04, color: '#fff' }}>
          {line}
        </div>
      ))}
      <div style={{ fontSize: sub, color: '#c9cbe0', marginTop: width * 0.012, fontWeight: 300 }}>{shot.sub}</div>
    </div>
  );
};

// A stylized browser window wrapping the screen recording: rounded card, titlebar with traffic-light
// dots and a faux address pill, the looping clip filling below.
const BrowserFrame = ({
  src,
  appear,
  width,
  top,
  addressLabel,
}: {
  src: string;
  appear: number;
  width: number;
  top: number;
  addressLabel: string;
}) => {
  const { width: vw } = useVideoConfig();
  const bar = width * 0.05;
  const dot = width * 0.012;
  const lift = interpolate(appear, [0, 1], [40, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: '50%',
        width,
        transform: `translateX(-50%) translateY(${lift}px)`,
        opacity: appear,
        borderRadius: vw * 0.012,
        overflow: 'hidden',
        background: '#15151f',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: `0 ${vw * 0.02}px ${vw * 0.05}px rgba(0,0,0,0.55)`,
      }}
    >
      <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: dot * 0.7, padding: `0 ${dot}px` }}>
        <span style={{ width: dot, height: dot, borderRadius: 999, background: '#ff5f57' }} />
        <span style={{ width: dot, height: dot, borderRadius: 999, background: '#febc2e' }} />
        <span style={{ width: dot, height: dot, borderRadius: 999, background: '#28c840' }} />
        <div
          style={{
            marginLeft: dot,
            flex: 1,
            height: bar * 0.5,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: dot,
            color: '#8a8ca6',
            fontFamily: OSWALD,
            fontSize: bar * 0.32,
            letterSpacing: 1,
          }}
        >
          {addressLabel}
        </div>
      </div>
      <div style={{ overflow: 'hidden' }}>
        <OffthreadVideo src={staticFile(`captures/${src}.mp4`)} muted style={{ width: '100%', display: 'block' }} />
      </div>
    </div>
  );
};

// Closing call-to-action: the brand wordmark over the gradient with a one-line pitch.
const Cta = ({ wordmark, headline, url }: { wordmark: string; headline: string; url: string }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const portrait = height >= width;
  const pop = spring({ frame, fps, durationInFrames: 26, config: { damping: 14, stiffness: 150, mass: 0.7 } });
  const fade = interpolate(frame, [0, OVERLAP], [0, 1], CLAMP);
  const rise = interpolate(pop, [0, 1], [36, 0]);

  return (
    <AbsoluteFill
      style={{
        opacity: fade,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: OSWALD,
        textAlign: 'center',
        transform: `translateY(${rise}px)`,
      }}
    >
      <div
        style={{
          fontSize: portrait ? width * 0.18 : width * 0.11,
          fontWeight: 700,
          background: BRAND_GRADIENT,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          // Roomy line height + bottom padding so descenders (the "p") aren't clipped by background-clip:text.
          lineHeight: 1.2,
          paddingBottom: '0.12em',
        }}
      >
        {wordmark}
      </div>
      <div
        style={{
          marginTop: width * 0.02,
          fontSize: portrait ? width * 0.045 : width * 0.028,
          color: '#fff',
          fontWeight: 600,
        }}
      >
        {headline}
      </div>
      <div
        style={{
          marginTop: width * 0.014,
          fontSize: portrait ? width * 0.03 : width * 0.018,
          color: '#9a9cb6',
          fontWeight: 300,
        }}
      >
        {url}
      </div>
    </AbsoluteFill>
  );
};
