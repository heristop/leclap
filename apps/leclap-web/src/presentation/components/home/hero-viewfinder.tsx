import { type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Volume2, VolumeX } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';

// One corner registration bracket of the hero viewfinder.
const Bracket = ({ className }: { className: string }) => (
  <span className={cn('absolute size-6 border-brand-300/60 sm:size-9', className)} />
);

interface HeroViewfinderProps {
  /** The SMPTE timecode readout node — painted directly by useHeroPlayhead, no re-renders. */
  timecodeRef: RefObject<HTMLSpanElement | null>;
  /** Whether the hero's synthesised clapper is switched on. */
  soundEnabled: boolean;
  onToggleSound: () => void;
}

// The program-monitor chrome that frames the whole hero as LeClap's own viewfinder: corner
// registration brackets, an "on-device" tally light (the privacy cue — the red light is ON and the
// footage still isn't going anywhere), and a live SMPTE timecode chip. Sits under the fixed header
// (top-20) and above the timeline. Decorative except the tally's label, which is real copy.
export function HeroViewfinder({ timecodeRef, soundEnabled, onToggleSound }: HeroViewfinderProps) {
  const { t } = useTranslation('home');
  const SoundIcon = soundEnabled ? Volume2 : VolumeX;

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
        className="fade-in absolute right-16 top-4 hidden items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[0.68rem] tracking-[0.08em] text-white/85 backdrop-blur-sm sm:right-[4.75rem] sm:top-5 sm:inline-flex"
        style={{ fontFamily: "'Roboto Mono', monospace", animationDelay: '0.5s' }}
      >
        <span className="text-white/45">TC</span>
        <span ref={timecodeRef} className="tabular-nums">
          00:00:00:00
        </span>
      </p>

      {/* Monitor audio — the hero's clapper is synthesised, and silent until it's asked for. The
          chrome is pointer-events-none, so the one real control here opts back in. */}
      <button
        type="button"
        onClick={onToggleSound}
        aria-pressed={soundEnabled}
        aria-label={t(soundEnabled ? 'hero.soundOff' : 'hero.soundOn')}
        className="fade-in pointer-events-auto absolute right-5 top-4 rounded-full bg-black/45 p-2 text-white/85 backdrop-blur-sm transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:right-7 sm:top-5"
        style={{ animationDelay: '0.6s' }}
      >
        <SoundIcon className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
