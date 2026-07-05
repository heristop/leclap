import { type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// One corner registration bracket of the hero viewfinder.
const Bracket = ({ className }: { className: string }) => (
  <span className={cn('absolute size-6 border-brand-300/60 sm:size-9', className)} />
);

interface HeroViewfinderProps {
  /** The SMPTE timecode readout node — painted directly by useHeroPlayhead, no re-renders. */
  timecodeRef: RefObject<HTMLSpanElement | null>;
}

// The program-monitor chrome that frames the whole hero as LeClap's own viewfinder: corner
// registration brackets, an "on-device" tally light (the privacy cue — the red light is ON and the
// footage still isn't going anywhere), and a live SMPTE timecode chip. Sits under the fixed header
// (top-20) and above the timeline. Decorative except the tally's label, which is real copy.
export function HeroViewfinder({ timecodeRef }: HeroViewfinderProps) {
  const { t } = useTranslation('home');

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 top-20 z-[5] sm:inset-x-7">
      {/* The monitor "powers on": brackets first, then the tally light, then the timecode. Plain
          fade-in keyframes, so the global reduced-motion reset lands them instantly settled. */}
      <span aria-hidden="true" className="fade-in">
        <Bracket className="left-0 top-0 rounded-tl-lg border-l-2 border-t-2" />
        <Bracket className="right-0 top-0 rounded-tr-lg border-r-2 border-t-2" />
        <Bracket className="bottom-0 left-0 rounded-bl-lg border-b-2 border-l-2" />
        <Bracket className="bottom-0 right-0 rounded-br-lg border-b-2 border-r-2" />
      </span>

      {/* Tally — a live recording light that only ever records to this device. */}
      <p
        className="fade-in absolute left-5 top-4 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm sm:left-7 sm:top-5"
        style={{ animationDelay: '0.35s' }}
      >
        <span aria-hidden="true" className="relative flex size-2">
          <span className="tally-ping absolute inset-0 rounded-full bg-[var(--color-error)]" />
          <span className="relative size-2 rounded-full bg-[var(--color-error)]" />
        </span>
        {t('hero.tally')}
      </p>

      {/* Timecode — updated straight on the DOM by the playhead loop; decorative for AT. */}
      <p
        aria-hidden="true"
        className="fade-in absolute right-5 top-4 hidden items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[0.68rem] tracking-[0.08em] text-white/85 backdrop-blur-sm sm:right-7 sm:top-5 sm:inline-flex"
        style={{ fontFamily: "'Roboto Mono', monospace", animationDelay: '0.5s' }}
      >
        <span className="text-white/45">TC</span>
        <span ref={timecodeRef} className="tabular-nums">
          00:00:00:00
        </span>
      </p>
    </div>
  );
}
