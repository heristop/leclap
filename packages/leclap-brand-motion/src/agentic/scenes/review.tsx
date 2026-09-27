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
import { LAVENDER } from '../../brand';
import { CLAMP, EASE, SceneShell } from '../../film/cinema';
import { ClapBody, useBlink, useHop } from '../../film/acting';
import { Clappy } from '../../film/clappy';
import { MONO } from '../../film/devices';
import { useLang, useT } from '../../film/lang';
import { SquintGauge } from '../../film/squint-gauge';
import { COPY } from '../copy';
import { AttachedPr, EVIDENCE, EvidencePoster, SLOT } from '../pr';
import { EVIDENCE_POSTER, FPS, REVIEW, sceneById } from '../timeline';

// 32–43s · The review. Play is pressed on the evidence in the pull request; the player grows out
// of the PR and takes the frame. BEFORE, the wipe, AFTER, then the one thing to review — narrated. The
// squint-o-meter falls out of the red on the wipe, Clappy cheers on AFTER. Exit: the camera flies into it.

const start = sceneById('review').from;
const at = (seconds: number): number => Math.round((seconds - start) * FPS);

const PLAY = at(REVIEW.play);
const WIPE = at(REVIEW.wipe);
const AFTER = at(REVIEW.after);
const GROW = 18;

const BIG = { x: 960, y: 548, w: 1344 };

export const ReviewScene = () => (
  <SceneShell enter="none" exit="zoom" exitOrigin="50% 51%" exitFrames={12}>
    <ReviewBody />
  </SceneShell>
);

const ReviewBody = () => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [4, 4 + GROW], [0, 1], { ...CLAMP, easing: EASE.inOutCubic });

  return (
    <AbsoluteFill style={{ background: '#0b0a14' }}>
      <AbsoluteFill
        style={{ filter: `blur(${grow * 9}px) brightness(${1 - grow * 0.62})`, transform: `scale(${1 - grow * 0.06})` }}
      >
        <AttachedPr dropFrame={-100} />
      </AbsoluteFill>
      <Player grow={grow} />
      <Gauge />
      <Cheer />
    </AbsoluteFill>
  );
};

/** The evidence player: poster + a click on play, then the real render, grown to fill the frame. */
const Player = ({ grow }: { grow: number }) => {
  const frame = useCurrentFrame();
  const t = useT();
  const lang = useLang();
  const width = interpolate(grow, [0, 1], [SLOT.w, BIG.w]);
  const cx = interpolate(grow, [0, 1], [SLOT.x, BIG.x]);
  const cy = interpolate(grow, [0, 1], [SLOT.y, BIG.y]);
  const height = (width * 9) / 16;
  const press = interpolate(frame, [0, 4, 8], [1, 0.9, 1], CLAMP);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: cx - width / 2,
          top: cy - height / 2,
          width,
          height,
          borderRadius: interpolate(grow, [0, 1], [16, 24]),
          overflow: 'hidden',
          boxShadow: `0 40px 120px rgba(0,0,0,0.7), 0 0 0 2px ${LAVENDER}aa`,
        }}
      >
        {frame < PLAY && <EvidencePoster />}
        {frame < PLAY && (
          <AbsoluteFill style={{ alignItems: 'flex-end', justifyContent: 'center', paddingRight: '17%' }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: 'rgba(12,12,20,0.6)',
                border: '2px solid rgba(255,255,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${press})`,
              }}
            >
              <svg width={36} height={40} viewBox="0 0 36 40">
                <path d="M6 4 L32 20 L6 36 Z" fill="#fff" />
              </svg>
            </div>
          </AbsoluteFill>
        )}
        <Sequence from={PLAY} layout="none">
          <OffthreadVideo
            src={staticFile(EVIDENCE[lang])}
            trimBefore={Math.round(EVIDENCE_POSTER * FPS)}
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
          opacity: grow,
        }}
      >
        {t(COPY.pr.player)}
      </div>
    </AbsoluteFill>
  );
};

/** The squint-o-meter: in the red through BEFORE, relieved on the wipe to AFTER. */
const Gauge = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useT();
  const appear = interpolate(frame, [GROW, GROW + 12], [0, 1], CLAMP);
  const relief =
    frame < WIPE + 10 ? 0 : spring({ frame: frame - WIPE - 10, fps, config: { damping: 6, stiffness: 90, mass: 0.8 } });

  return (
    <div style={{ position: 'absolute', right: 24, bottom: 160, opacity: appear }}>
      <SquintGauge relief={relief} label={t(COPY.squint)} width={230} />
    </div>
  );
};

/** Clappy pops up in the corner when AFTER lands, arms up. */
const Cheer = () => {
  const frame = useCurrentFrame();
  const hop = useHop(AFTER + 8, 70, 12);
  const blink = useBlink(22);
  const appear = interpolate(frame, [AFTER + 6, AFTER + 12, 300, 312], [0, 1, 1, 0], CLAMP);

  if (appear <= 0) return null;

  return (
    <div style={{ position: 'absolute', left: 60, bottom: 60, opacity: appear }}>
      <ClapBody y={hop.y} sx={hop.sx} sy={hop.sy} rotate={-6}>
        <Clappy
          size={190}
          angle={-26}
          lookX={0.8}
          lookY={-0.4}
          blink={blink}
          mood="grin"
          armL={150 + Math.sin(frame / 4) * 10}
          armR={150 + Math.cos(frame / 4) * 10}
        />
      </ClapBody>
    </div>
  );
};
