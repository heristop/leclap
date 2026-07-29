import { type ChangeEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { SCRUB_RESOLUTION } from './use-hero-playhead';

// NLE-style ruler ticks over the scrubber: a minor tick every 12px (bottom 45% tall) under a major
// tick every 72px (full height). Two repeating gradients — zero extra DOM, zero animation cost.
const RULER_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(to right, oklch(1 0 0 / 0.22) 0, oklch(1 0 0 / 0.22) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(to right, oklch(1 0 0 / 0.4) 0, oklch(1 0 0 / 0.4) 1px, transparent 1px, transparent 72px)',
  backgroundSize: '100% 45%, 100% 100%',
  backgroundPosition: 'bottom left, bottom left',
  backgroundRepeat: 'no-repeat',
} as const;

interface HeroTimelineProps {
  scrubRef: RefObject<HTMLInputElement | null>;
  onScrub: (event: ChangeEvent<HTMLInputElement>) => void;
}

// The hero's working timeline — a real, keyboard-operable scrubber (a styled range input riding the
// shared studio-range playhead) that seeks the background film, framed by ruler ticks and the
// editor's track badges. This is the hero's interaction: the landing page is already an edit bay.
export function HeroTimeline({ scrubRef, onScrub }: HeroTimelineProps) {
  const { t } = useTranslation('home');

  return (
    // The strip is the last piece of chrome to appear — the deck comes online after the type has
    // assembled. Plain fade-in, so reduced-motion viewers get it settled instantly.
    // inset-x-11 clears the viewfinder's bottom corner brackets (inset-x-4 + size-6) on phones,
    // where the track would otherwise run straight through them; sm+ has room for the wider gutter.
    <div className="fade-in absolute inset-x-11 bottom-7 z-[6] sm:inset-x-16" style={{ animationDelay: '0.85s' }}>
      {/* items-end + the badges' bottom nudge keeps their centers on the track line, not the
          taller ruler+track column's center. */}
      <div className="flex items-end gap-3">
        <span
          aria-hidden="true"
          className="mb-0.5 hidden rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[0.6rem] font-semibold tracking-[0.14em] text-white/60 sm:inline-block"
          style={{ fontFamily: "'Roboto Mono', monospace" }}
        >
          V1
        </span>
        {/* Ruler + scrubber share one column so the ticks line up exactly with the track. */}
        <div className="min-w-0 flex-1">
          <div aria-hidden="true" className="mb-1 h-2.5 w-full opacity-70" style={RULER_STYLE} />
          <input
            ref={scrubRef}
            type="range"
            min={0}
            max={SCRUB_RESOLUTION}
            step={1}
            defaultValue={0}
            aria-label={t('hero.scrubAria')}
            onChange={onScrub}
            className="studio-range w-full"
          />
        </div>
        <span
          aria-hidden="true"
          className="mb-0.5 hidden rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[0.6rem] font-semibold tracking-[0.14em] text-white/60 sm:inline-block"
          style={{ fontFamily: "'Roboto Mono', monospace" }}
        >
          FFMPEG·WASM
        </span>
      </div>
    </div>
  );
}
