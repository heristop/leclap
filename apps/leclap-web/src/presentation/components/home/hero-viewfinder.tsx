import { type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Volume2, VolumeX } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';

// One corner registration bracket of the hero viewfinder.
const Bracket = ({ className }: { className: string }) => (
  <span className={cn('absolute size-6 border-brand-300/60 sm:size-9', className)} />
);

/**
 * A round glass monitor button: 32px visible, the `before` overlay pads the hit area out to 44px, and the
 * cluster's gap keeps neighbouring hit areas from overlapping. Keyboard focus is the site-wide brand outline
 * (index.css), the same ring as the film controls. No colour transition, so the `tap` press spring keeps its
 * transform transition; the entrance fade lives on the wrapper for the same reason (its fill would pin
 * `transform` and swallow the press).
 */
const MonitorButton = ({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="tap relative grid size-8 place-items-center rounded-full bg-black/45 text-white/85 backdrop-blur-sm before:absolute before:-inset-1.5 before:content-[''] hover:text-white [&_svg]:size-3.5"
  >
    {children}
  </button>
);

interface HeroViewfinderProps {
  /** The SMPTE timecode readout node — painted directly by useHeroPlayhead, no re-renders. */
  timecodeRef: RefObject<HTMLSpanElement | null>;
  /** Whether the landing's sound is on (every video, and the hero's synthesised clapper). */
  soundEnabled: boolean;
  onToggleSound: () => void;
  /** Whether the visitor paused the monitor. */
  paused: boolean;
  onTogglePause: () => void;
}

// The program-monitor chrome that frames the whole hero as LeClap's own viewfinder: corner
// registration brackets, an "on-device" tally light (the privacy cue — the red light is ON and the
// footage still isn't going anywhere), and a live SMPTE timecode chip beside the monitor's two real
// controls, pause and sound. Sits under the fixed header (top-20) and above the timeline. Decorative
// except the tally's label, which is real copy, and those two buttons. It layers above the copy (z-20
// over the copy's z-10) like a camera HUD: the copy's padding box spans the whole stage on phones and
// desktops, and from underneath it would swallow every click meant for the buttons. The root stays
// pointer-events-none, so only the buttons themselves take input.
export function HeroViewfinder({
  timecodeRef,
  soundEnabled,
  onToggleSound,
  paused,
  onTogglePause,
}: HeroViewfinderProps) {
  const { t } = useTranslation('home');
  const SoundIcon = soundEnabled ? Volume2 : VolumeX;

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 top-20 z-20 sm:inset-x-7">
      {/* The monitor "powers on": brackets first, then the tally light, then the timecode. Plain
          fade-in keyframes, so the global reduced-motion reset lands them instantly settled. */}
      <span aria-hidden="true" className="fade-in">
        <Bracket className="left-0 top-0 rounded-tl-lg border-l-2 border-t-2" />
        <Bracket className="right-0 top-0 rounded-tr-lg border-r-2 border-t-2" />
        <Bracket className="bottom-0 left-0 rounded-bl-lg border-b-2 border-l-2" />
        <Bracket className="bottom-0 right-0 rounded-br-lg border-b-2 border-r-2" />
      </span>

      {/* Tally — a live recording light that only ever records to this device. Its row is as tall as the
          buttons opposite, so both corners share one centre line. */}
      <div className="absolute left-5 top-4 flex h-8 items-center sm:left-7 sm:top-5">
        <p
          className="fade-in inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm"
          style={{ animationDelay: '0.35s' }}
        >
          <span aria-hidden="true" className="relative flex size-2">
            <span className="tally-ping absolute inset-0 rounded-full bg-[var(--color-error)]" />
            <span className="relative size-2 rounded-full bg-[var(--color-error)]" />
          </span>
          {t('hero.tally')}
        </p>
      </div>

      <div className="absolute right-5 top-4 flex h-8 items-center gap-3 sm:right-7 sm:top-5">
        {/* Timecode — updated straight on the DOM by the playhead loop; decorative for AT. */}
        <p
          aria-hidden="true"
          className="fade-in hidden items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[0.68rem] tracking-[0.08em] text-white/85 backdrop-blur-sm sm:inline-flex"
          style={{ fontFamily: "'Roboto Mono', monospace", animationDelay: '0.5s' }}
        >
          <span className="text-white/45">TC</span>
          <span ref={timecodeRef} className="tabular-nums">
            00:00:00:00
          </span>
        </p>

        {/* Transport — the film and its ambient loops hold until the visitor presses play again. The chrome
            is pointer-events-none, so the real controls opt back in. */}
        <span className="fade-in pointer-events-auto" style={{ animationDelay: '0.55s' }}>
          <MonitorButton label={t(paused ? 'hero.play' : 'hero.pause')} onClick={onTogglePause}>
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </MonitorButton>
        </span>

        {/* The landing's one sound switch — every video on the page and the deck's synthesised clapper, all
            silent until it's asked for. The label names the action, so the button carries no pressed state
            that would contradict it. */}
        <span className="fade-in pointer-events-auto" style={{ animationDelay: '0.6s' }}>
          <MonitorButton label={t(soundEnabled ? 'sound.off' : 'sound.on')} onClick={onToggleSound}>
            <SoundIcon aria-hidden="true" />
          </MonitorButton>
        </span>
      </div>
    </div>
  );
}
