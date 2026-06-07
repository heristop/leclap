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

// Deterministic decorative waveform (no real audio analysis) — gives the track a "media timeline" feel.
const WAVEFORM = Array.from({ length: 72 }, (_, i) => {
  const v = Math.abs(Math.sin(i * 0.8) * 0.5 + Math.sin(i * 0.31) * 0.32 + Math.sin(i * 1.9) * 0.22);
  const edge = Math.min(i, 71 - i) / 8; // taper the ends

  return Math.round((18 + Math.min(v, 1) * 70) * Math.min(1, 0.45 + edge)); // ~8%..~88%
});

/**
 * A grabber handle. Positioned with `left: pct%` + `translateX(-pct%)` so it stays flush INSIDE the
 * track at the extremes (no horizontal overflow) and is contained within the track height (no
 * vertical protrusion). Presentation only — drag logic stays in TrimBar.
 */
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
      className="group absolute inset-y-1.5 w-4 cursor-ew-resize touch-none"
      style={{ left: `${pct}%`, transform: `translateX(${-pct}%)` }}
    >
      {/* live time bubble while dragging */}
      <span
        className={cn(
          'pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-brand-500 text-white text-xs font-semibold tabular-nums shadow-lg shadow-brand-500/50 transition-all duration-150',
          dragging ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-95'
        )}
      >
        {label}
        <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 bg-brand-500" />
      </span>

      {/* wider invisible hit area without enlarging the visible bar */}
      <span aria-hidden="true" className="absolute -left-2 -right-2 inset-y-0" />

      {/* grabber bar */}
      <div
        className={cn(
          'relative h-full w-full rounded-full bg-gradient-to-b from-brand-300 to-brand-500 shadow-md shadow-brand-500/40 ring-1 ring-white/50 flex flex-col items-center justify-center gap-1 transition-transform duration-150 ease-[var(--ease-spring)]',
          'group-hover:scale-y-105 group-active:scale-95',
          dragging && 'ring-2 ring-white/70 shadow-brand-500/70'
        )}
      >
        <span className="w-0.5 h-3.5 rounded-full bg-white/90" />
        <span className="w-0.5 h-3.5 rounded-full bg-white/90" />
      </div>
    </div>
  );
}

/**
 * A dual-handle trim timeline over a cinematic waveform track. Dragging a handle reports the new
 * range in seconds and seeks the player; hovering previews the seek position; tapping the track
 * scrubs. Works with mouse and touch via pointer events.
 */
export function TrimBar({ duration, value, currentTime, onChange, onSeek }: TrimBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const safeDuration = duration > 0 ? duration : 1;

  const pctFromClientX = (clientX: number): number => {
    const track = trackRef.current;

    if (!track) {
      return 0;
    }

    const rect = track.getBoundingClientRect();

    return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
  };

  const dragHandle = (which: 'start' | 'end') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(which);

    const onMove = (ev: PointerEvent) => {
      const t = (pctFromClientX(ev.clientX) / 100) * safeDuration;

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
    onSeek((pctFromClientX(e.clientX) / 100) * safeDuration);
  };

  // Mouse-hover preview of the seek position (ignored mid-drag and on touch).
  const onTrackHover = (e: React.PointerEvent) => {
    if (dragging || e.pointerType !== 'mouse') return;

    setHoverPct(pctFromClientX(e.clientX));
  };

  const startPct = (value.start / safeDuration) * 100;
  // Until metadata loads, value.end is 0 — show the end handle at the right edge, not overlapping the start.
  const endPct = value.end > 0 ? (value.end / safeDuration) * 100 : 100;
  const playPct = clamp((currentTime / safeDuration) * 100, 0, 100);
  const showHover = hoverPct !== null && !dragging;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2.5 text-sm tabular-nums">
        <span className={cn('transition-colors', dragging === 'start' ? 'text-brand-700 dark:text-brand-300 font-semibold' : 'text-gray-300')}>{formatTime(value.start)}</span>
        <span className="px-2.5 py-0.5 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold text-xs ring-1 ring-brand-500/20">{formatTime(value.end - value.start)} selected</span>
        <span className={cn('transition-colors', dragging === 'end' ? 'text-brand-700 dark:text-brand-300 font-semibold' : 'text-gray-300')}>{formatTime(value.end)}</span>
      </div>

      {/* Unclipped stage: the track clips its waveform/overlays, while handles + bubbles overflow above it. */}
      <div className="relative">
        <div
          ref={trackRef}
          onPointerDown={seekFromTrack}
          onPointerMove={onTrackHover}
          onPointerLeave={() => { setHoverPct(null); }}
          className="relative h-14 rounded-xl overflow-hidden cursor-pointer ring-1 ring-white/10 shadow-inner"
          style={{ background: 'linear-gradient(to bottom, oklch(0.28 0.02 280), oklch(0.19 0.02 280))' }}
        >
          {/* decorative waveform */}
          <div aria-hidden="true" className="absolute inset-x-3 inset-y-0 flex items-center gap-[2px]">
            {WAVEFORM.map((h, i) => (
              <span key={i} className="flex-1 min-w-0 rounded-full bg-white/20" style={{ height: `${h}%` }} />
            ))}
          </div>

          {/* dimmed outside-selection regions */}
          <div className="absolute inset-y-0 left-0 bg-black/60 backdrop-blur-[1px]" style={{ width: `${startPct}%` }} />
          <div className="absolute inset-y-0 right-0 bg-black/60 backdrop-blur-[1px]" style={{ width: `${100 - endPct}%` }} />

          {/* selected window fill (no border — dim + handles delineate it; clipped to the track radius) */}
          <div
            className={cn(
              'absolute inset-y-0 bg-gradient-to-b from-brand-500/30 to-brand-500/10',
              !dragging && 'transition-[left,width] duration-150 ease-out'
            )}
            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          />

          {/* hover-scrub ghost line */}
          {showHover && (
            <div className="pointer-events-none absolute inset-y-0 -ml-px w-px bg-white/45" style={{ left: `${hoverPct}%` }} />
          )}

          {/* playhead */}
          <div
            className={cn('absolute inset-y-1 -ml-px w-0.5 bg-white/90 rounded-full', !dragging && 'transition-[left] duration-100 ease-linear')}
            style={{ left: `${playPct}%` }}
          />
        </div>

        {/* hover-scrub time label (outer, unclipped) */}
        {showHover && (
          <span
            className="pointer-events-none absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-white text-gray-900 text-[10px] font-semibold tabular-nums shadow-md"
            style={{ left: `${hoverPct}%` }}
          >
            {formatTime((hoverPct / 100) * safeDuration)}
          </span>
        )}

        {/* handles (siblings of the clipped track so bubbles can overflow) */}
        <TrimHandle side="start" pct={startPct} label={formatTime(value.start)} valueNow={Math.round(value.start)} dragging={dragging === 'start'} onPointerDown={dragHandle('start')} />
        <TrimHandle side="end" pct={endPct} label={formatTime(value.end)} valueNow={Math.round(value.end)} dragging={dragging === 'end'} onPointerDown={dragHandle('end')} />
      </div>
    </div>
  );
}

export default TrimBar;
