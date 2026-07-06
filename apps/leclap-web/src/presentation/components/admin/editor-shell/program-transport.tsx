// The program monitor's transport bar: play/pause, a scrubbable timeline with scene tick marks, and
// an NLE timecode readout. All per-frame updates (range value, gradient fill, timecode text) are
// written straight to refs by the clock subscription — the studio-range/--range-pct pattern from the
// home hero — so scrubbing and playback stay at 60fps with zero re-renders.
import { useEffect, useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayIcon } from '@/presentation/components/icons/play';
import { PauseIcon } from '@/presentation/components/icons/pause';
import { formatTimecode } from '../../home/hero-timecode.logic';
import { totalDuration, type Segment } from './program-timeline.logic';
import type { ProgramClock } from './use-program-clock';

const SCRUB_RESOLUTION = 1000;

interface ProgramTransportProps {
  clock: ProgramClock;
  timeline: Segment[];
}

export const ProgramTransport = ({ clock, timeline }: ProgramTransportProps) => {
  const { t } = useTranslation('admin');
  const rangeRef = useRef<HTMLInputElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const total = totalDuration(timeline);

  useEffect(() => {
    return clock.subscribe((time) => {
      const ratio = total > 0 ? time / total : 0;
      const range = rangeRef.current;
      const readout = timecodeRef.current;

      if (readout) readout.textContent = formatTimecode(time);

      if (!range) return;

      range.valueAsNumber = Math.round(ratio * SCRUB_RESOLUTION);
      range.style.setProperty('--range-pct', `${(ratio * 100).toFixed(2)}%`);
    });
  }, [clock, total]);

  const onScrub = (event: ChangeEvent<HTMLInputElement>): void => {
    clock.seekRatio(event.target.valueAsNumber / SCRUB_RESOLUTION);
  };

  return (
    // Docked inside the ProgramMonitor between the stage's gradient out-edge and the status strip,
    // so it reads as one piece of deck chrome (padding aligned with the strip, no extra border).
    <div className="flex items-center gap-3 bg-surface-2/40 px-4 py-2">
      <button
        type="button"
        onClick={clock.toggle}
        aria-label={clock.playing ? t('monitor.pause') : t('monitor.play')}
        className="tap relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-brand-500/15 text-brand-600 transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-brand-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-300"
      >
        {clock.playing ? <PauseIcon size={16} /> : <PlayIcon size={16} className="translate-x-px" />}
      </button>
      <div className="relative flex-1">
        <input
          ref={rangeRef}
          type="range"
          min={0}
          max={SCRUB_RESOLUTION}
          defaultValue={0}
          onChange={onScrub}
          aria-label={t('monitor.scrub')}
          className="studio-range w-full"
        />
        {/* Scene boundary ticks over the track, so cuts are visible while scrubbing. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-0 -translate-y-1/2">
          {timeline.slice(0, -1).map((segment) => (
            <span
              key={segment.index}
              className="absolute top-[-4px] h-2 w-px bg-foreground/30"
              style={{ left: `${((segment.end / total) * 100).toFixed(2)}%` }}
            />
          ))}
        </div>
      </div>
      <span ref={timecodeRef} className="w-24 shrink-0 text-right font-mono text-[0.7rem] tabular-nums text-gray-500">
        00:00:00:00
      </span>
    </div>
  );
};
