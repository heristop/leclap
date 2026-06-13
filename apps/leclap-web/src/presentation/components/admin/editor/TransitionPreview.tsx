// Pure-CSS animated thumbnail for a transition type. Two colored panes loop the
// transition's family (fade/wipe/slide/circle/slice/cover/reveal/zoom/blur/pixel) so the
// author previews roughly what each option does without rendering anything. Animations
// run continuously (the grid is "alive") and pause under prefers-reduced-motion.
import { useTranslation } from 'react-i18next';
import { previewFamilyFor, type PreviewFamily } from './transitionGroups';

// One @keyframes block per family, scoped by a unique class so several thumbnails can
// animate independently. The incoming (brand) pane animates in over the outgoing pane.
const KEYFRAMES: Record<PreviewFamily, string> = {
  fade: '@keyframes tp-fade{0%,12%{opacity:0}88%,100%{opacity:1}}',
  wipe: '@keyframes tp-wipe{0%,12%{clip-path:inset(0 100% 0 0)}88%,100%{clip-path:inset(0 0 0 0)}}',
  slide: '@keyframes tp-slide{0%,12%{transform:translateX(100%)}88%,100%{transform:translateX(0)}}',
  circle: '@keyframes tp-circle{0%,12%{clip-path:circle(0% at 50% 50%)}88%,100%{clip-path:circle(75% at 50% 50%)}}',
  slice:
    '@keyframes tp-slice{0%,12%{clip-path:polygon(0 0,0 0,0 100%,0 100%)}88%,100%{clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}}',
  cover: '@keyframes tp-cover{0%,12%{transform:translateY(-100%)}88%,100%{transform:translateY(0)}}',
  reveal: '@keyframes tp-reveal{0%,12%{clip-path:inset(0 0 100% 0)}88%,100%{clip-path:inset(0 0 0 0)}}',
  zoom: '@keyframes tp-zoom{0%,12%{opacity:0;transform:scale(1.6)}88%,100%{opacity:1;transform:scale(1)}}',
  blur: '@keyframes tp-blur{0%,12%{opacity:0;filter:blur(6px)}88%,100%{opacity:1;filter:blur(0)}}',
  pixel: '@keyframes tp-pixel{0%,12%{opacity:0;filter:contrast(2.2) saturate(0)}88%,100%{opacity:1;filter:none}}',
};

interface TransitionPreviewProps {
  /** xfade name, or 'cut' for a hard cut (no animation). */
  type: string;
  className?: string;
}

export const TransitionPreview = ({ type, className }: TransitionPreviewProps) => {
  const { t } = useTranslation('admin');

  if (type === 'cut') {
    return (
      <div className={className}>
        <div className="grid h-full w-full place-items-center rounded-md bg-gradient-to-br from-secondary-500/70 to-brand-500/70 text-[0.6rem] font-bold uppercase tracking-wider text-white/90">
          {t('transition.cut')}
        </div>
      </div>
    );
  }

  const family = previewFamilyFor(type);
  const animation = `tp-${family} 1.4s var(--ease-out-expo, ease-out) infinite alternate`;

  return (
    <div className={className}>
      <style>
        {KEYFRAMES[family]}
        {REDUCED_MOTION_RULE}
      </style>
      <div className="relative h-full w-full overflow-hidden rounded-md bg-secondary-500/70">
        <div className="absolute inset-0 bg-brand-500" style={{ animation }} data-tp-pane />
      </div>
    </div>
  );
};

// Freeze the preview on its resting (incoming) frame when the user prefers reduced motion.
const REDUCED_MOTION_RULE =
  '@media (prefers-reduced-motion: reduce){[data-tp-pane]{animation:none!important;opacity:1;transform:none;filter:none;clip-path:none}}';
