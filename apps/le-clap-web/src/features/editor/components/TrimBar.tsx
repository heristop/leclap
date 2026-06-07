import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { VideoTrim } from '@/domain/valueObjects/videoEdits';

interface TrimBarProps {
  duration: number;
  value: VideoTrim;
  currentTime: number;
  onChange: (next: VideoTrim) => void;
  onSeek: (seconds: number) => void;
}

const MIN_GAP = 0.5; // keep at least 0.5s between handles

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

const formatTime = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/** A grabber handle with a live time bubble. Presentation only — drag logic stays in TrimBar. */
function TrimHandle({
  side,
  pct,
  label,
  valueNow,
  dragging,
  onPointerDown,
}: {
  side: 'start' | 'end';
  pct: number;
  label: string;
  valueNow: number;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      role="slider"
      aria-label={side === 'start' ? 'Trim start' : 'Trim end'}
      aria-valuenow={valueNow}
      tabIndex={0}
      onPointerDown={onPointerDown}
      className="group absolute -top-1.5 -bottom-1.5 w-6 -ml-3 flex items-center justify-center cursor-ew-resize touch-none"
      style={{ left: `${pct}%` }}
    >
      {/* live time bubble while dragging */}
      <span
        className={cn(
          'pointer-events-none absolute -top-9 px-2 py-0.5 rounded-md bg-brand-500 text-white text-xs font-semibold tabular-nums shadow-lg shadow-brand-500/40 transition-all duration-150',
          dragging ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-95'
        )}
      >
        {label}
        <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 bg-brand-500" />
      </span>

      {/* grabber */}
      <div
        className={cn(
          'h-full w-3 rounded-md bg-gradient-to-b from-brand-300 to-brand-500 shadow-lg shadow-brand-500/40 ring-1 ring-white/40 flex items-center justify-center gap-0.5 transition-transform duration-150 ease-[var(--ease-spring)]',
          'group-hover:scale-110 group-active:scale-95',
          dragging && 'scale-110 shadow-brand-500/70 ring-2 ring-white/60'
        )}
      >
        <span className="w-0.5 h-4 rounded-full bg-white/85" />
        <span className="w-0.5 h-4 rounded-full bg-white/85" />
      </div>
    </div>
  );
}

/**
 * A dual-handle trim timeline. Dragging a handle reports the new range in seconds and seeks
 * the player so the user previews the exact in/out frame; tapping the track scrubs. Works with
 * mouse and touch via pointer events.
 */
export function TrimBar({ duration, value, currentTime, onChange, onSeek }: TrimBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const safeDuration = duration > 0 ? duration : 1;

  const timeFromClientX = (clientX: number): number => {
    const track = trackRef.current;

    if (!track) {
      return 0;
    }

    const rect = track.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);

    return ratio * safeDuration;
  };

  const dragHandle = (which: 'start' | 'end') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(which);

    const onMove = (ev: PointerEvent) => {
      const t = timeFromClientX(ev.clientX);

      if (which === 'start') {
        const next = clamp(t, 0, value.end - MIN_GAP);
        onChange({ start: next, end: value.end });
        onSeek(next);

        return;
      }

      const next = clamp(t, value.start + MIN_GAP, safeDuration);
      onChange({ start: value.start, end: next });
      onSeek(next);
    };

    const onUp = () => {
      setDragging(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Tap anywhere on the track to scrub the preview (handles stop propagation, so they're unaffected).
  const seekFromTrack = (e: React.PointerEvent) => {
    onSeek(timeFromClientX(e.clientX));
  };

  const startPct = (value.start / safeDuration) * 100;
  const endPct = (value.end / safeDuration) * 100;
  const playPct = clamp((currentTime / safeDuration) * 100, 0, 100);

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2 text-sm tabular-nums">
        <span className={cn('transition-colors', dragging === 'start' ? 'text-brand-700 dark:text-brand-300 font-semibold' : 'text-gray-300')}>{formatTime(value.start)}</span>
        <span className="px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold text-xs">{formatTime(value.end - value.start)} selected</span>
        <span className={cn('transition-colors', dragging === 'end' ? 'text-brand-700 dark:text-brand-300 font-semibold' : 'text-gray-300')}>{formatTime(value.end)}</span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={seekFromTrack}
        className="relative h-12 rounded-xl bg-foreground/10 touch-none cursor-pointer overflow-hidden ring-1 ring-foreground/5"
      >
        {/* decorative filmstrip ticks */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 9px, var(--color-foreground) 9px 10px)' }}
        />

        {/* dimmed outside-selection regions */}
        <div className="absolute inset-y-0 left-0 bg-black/40 backdrop-blur-[1px]" style={{ width: `${startPct}%` }} />
        <div className="absolute inset-y-0 right-0 bg-black/40 backdrop-blur-[1px]" style={{ width: `${100 - endPct}%` }} />

        {/* selected window */}
        <div
          className={cn(
            'absolute inset-y-0 rounded-xl border-2 border-brand-400 bg-gradient-to-b from-brand-500/25 to-brand-500/5 shadow-lg shadow-brand-500/30',
            !dragging && 'transition-[left,width] duration-150 ease-out'
          )}
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />

        {/* playhead */}
        <div
          className={cn('absolute inset-y-1 -ml-px w-0.5 bg-white rounded-full shadow-md shadow-white/60', !dragging && 'transition-[left] duration-100 ease-linear')}
          style={{ left: `${playPct}%` }}
        >
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md shadow-white/60" />
        </div>

        {/* handles */}
        <TrimHandle side="start" pct={startPct} label={formatTime(value.start)} valueNow={Math.round(value.start)} dragging={dragging === 'start'} onPointerDown={dragHandle('start')} />
        <TrimHandle side="end" pct={endPct} label={formatTime(value.end)} valueNow={Math.round(value.end)} dragging={dragging === 'end'} onPointerDown={dragHandle('end')} />
      </div>
    </div>
  );
}

export default TrimBar;
