import { useRef } from 'react';
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

/**
 * A dual-handle trim timeline. Dragging a handle reports the new range in seconds and seeks
 * the player so the user previews the exact in/out frame. Works with mouse and touch via
 * pointer events.
 */
export function TrimBar({ duration, value, currentTime, onChange, onSeek }: TrimBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
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
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startPct = (value.start / safeDuration) * 100;
  const endPct = (value.end / safeDuration) * 100;
  const playPct = clamp((currentTime / safeDuration) * 100, 0, 100);

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2 text-sm tabular-nums">
        <span className="text-gray-300">{formatTime(value.start)}</span>
        <span className="text-brand-700 dark:text-brand-300 font-medium">{formatTime(value.end - value.start)} selected</span>
        <span className="text-gray-300">{formatTime(value.end)}</span>
      </div>

      <div ref={trackRef} className="relative h-12 rounded-xl bg-foreground/10 touch-none">
        {/* dimmed outside-selection regions */}
        <div className="absolute inset-y-0 left-0 bg-black/40 rounded-l-xl" style={{ width: `${startPct}%` }} />
        <div className="absolute inset-y-0 right-0 bg-black/40 rounded-r-xl" style={{ width: `${100 - endPct}%` }} />

        {/* selected window */}
        <div
          className="absolute inset-y-0 border-2 border-brand-400 rounded-xl bg-brand-500/10"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />

        {/* playhead */}
        <div className="absolute inset-y-1 w-0.5 bg-white" style={{ left: `${playPct}%` }} />

        {/* handles */}
        <div
          role="slider"
          aria-label="Trim start"
          aria-valuenow={Math.round(value.start)}
          tabIndex={0}
          onPointerDown={dragHandle('start')}
          className="absolute -top-1 -bottom-1 w-5 -ml-2.5 rounded-md bg-brand-400 cursor-ew-resize shadow-lg flex items-center justify-center"
          style={{ left: `${startPct}%` }}
        >
          <div className="w-0.5 h-5 bg-foreground/80 rounded-full" />
        </div>
        <div
          role="slider"
          aria-label="Trim end"
          aria-valuenow={Math.round(value.end)}
          tabIndex={0}
          onPointerDown={dragHandle('end')}
          className="absolute -top-1 -bottom-1 w-5 -ml-2.5 rounded-md bg-brand-400 cursor-ew-resize shadow-lg flex items-center justify-center"
          style={{ left: `${endPct}%` }}
        >
          <div className="w-0.5 h-5 bg-foreground/80 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default TrimBar;
