import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClipSegment } from '@/domain/valueObjects/videoEdits';
import { SegmentMenu } from '@/features/editor/components/SegmentMenu';
import { trimKeyTarget } from '@/features/editor/editor-keys';

type TrimSide = 'start' | 'end';

interface TimelineProps {
  segments: ClipSegment[];
  selectedId: string | null;
  duration: number; // source seconds — the track is laid out in source time
  sourceTime: number; // current source playhead
  onSelect: (id: string) => void;
  onSeekSource: (sourceSeconds: number) => void;
  // A drag on a handle is one history step: onTrimStart at the grab, then unrecorded onTrim moves.
  onTrimStart: () => void;
  onTrim: (id: string, side: TrimSide, sourceTime: number, record?: boolean) => void;
  onSetSpeed: (id: string, speed: number) => void;
  onSplitAt: (sourceSeconds: number) => void;
  onDelete: (id: string) => void;
}

interface MenuState {
  x: number;
  y: number;
  segment: ClipSegment;
  sourceTime: number;
}

const fmtClock = (seconds: number): string => {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total - Math.floor(total)) * 10);

  return `${m}:${s.toString().padStart(2, '0')}.${cs}`;
};

// Deterministic decorative waveform painted across the full-clip placeholder, so the track reads as a
// real media clip and the trimmed-away ends stay visible behind the kept block.
const WAVEFORM = Array.from({ length: 96 }, (_, i) => {
  const v = Math.abs(Math.sin(i * 0.7) * 0.5 + Math.sin(i * 0.29) * 0.3 + Math.sin(i * 1.8) * 0.2);

  return Math.round(22 + Math.min(v, 1) * 64);
});

// A grabbable edge of the selected block. Drag maps px → source seconds (the track is source-scaled, so
// no speed factor) and shows a live time bubble. A wide invisible hit area keeps it touch-friendly. It
// is a real slider for the keyboard too (see trimKeyTarget): the arrows nudge the edge and the bubble
// shows while it has focus, so a keyboard trim reads the same as a dragged one.
function TrimHandle({
  side,
  segment,
  duration,
  trackWidth,
  onTrimStart,
  onTrim,
}: {
  side: TrimSide;
  segment: ClipSegment;
  duration: number;
  trackWidth: () => number;
  onTrimStart: () => void;
  onTrim: (id: string, side: TrimSide, sourceTime: number, record?: boolean) => void;
}) {
  const { t } = useTranslation('builder');
  const [dragging, setDragging] = useState(false);
  const value = side === 'start' ? segment.start : segment.end;

  const onPointerDown = (e: React.PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    onTrimStart();
    const startX = e.clientX;
    const width = trackWidth();

    const onMove = (ev: PointerEvent): void => {
      onTrim(segment.id, side, value + ((ev.clientX - startX) / Math.max(1, width)) * duration, false);
    };
    const onUp = (): void => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    const target = trimKeyTarget(e.key, e.shiftKey, value, duration);

    if (target === null) return;

    e.preventDefault();
    e.stopPropagation();
    onTrim(segment.id, side, target);
  };

  return (
    <div
      role="slider"
      aria-label={side === 'start' ? t('edit.trimStart') : t('edit.trimEnd')}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration * 10) / 10}
      aria-valuenow={Math.round(value * 10) / 10}
      aria-valuetext={fmtClock(value)}
      aria-orientation="horizontal"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      // 44px-wide hit area for comfortable touch dragging; the visible grip stays slim.
      className={cn(
        'group/handle absolute inset-y-0 z-30 flex w-11 cursor-ew-resize touch-none items-center justify-center rounded-md focus-visible:outline-none',
        side === 'start' ? '-left-[22px]' : '-right-[22px]'
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute -top-8 whitespace-nowrap rounded-md bg-brand-500 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-white shadow-lg transition-all duration-150 group-focus-visible/handle:scale-100 group-focus-visible/handle:opacity-100',
          dragging ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        )}
      >
        {fmtClock(value)}
      </span>
      <span
        className={cn(
          'flex h-10 w-2.5 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/20 transition-transform duration-150 group-focus-visible/handle:ring-2 group-focus-visible/handle:ring-brand-400',
          dragging ? 'scale-y-110 ring-2 ring-brand-400' : 'group-hover:scale-y-110'
        )}
      >
        <span className="h-4 w-0.5 rounded-full bg-gray-400" />
      </span>
    </div>
  );
}

/**
 * Source-time timeline. The whole clip is a dim placeholder track (with a waveform); each kept segment
 * sits on it as a bright block at its source position, so the trimmed-away ends stay visible behind it.
 * Drag a selected block's edges to trim; click anywhere to move the playhead; the seams mark the cuts.
 */
export function Timeline({
  segments,
  selectedId,
  duration,
  sourceTime,
  onSelect,
  onSeekSource,
  onTrimStart,
  onTrim,
  onSetSpeed,
  onSplitAt,
  onDelete,
}: TimelineProps) {
  const { t } = useTranslation('builder');
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const total = duration > 0 ? duration : 1;

  const openMenu = (segment: ClipSegment, clientX: number, clientY: number, atSource: number): void => {
    onSelect(segment.id);
    setMenu({ x: clientX, y: clientY, segment, sourceTime: atSource });
  };

  const sourceAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();

    if (!rect) return 0;

    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1) * total;
  };

  const trackWidth = (): number => trackRef.current?.getBoundingClientRect().width ?? 1;
  const playPct = Math.min(100, (sourceTime / total) * 100);

  // Keyboard parity for a block: Enter/Space selects it (bringing up its trim handles) and parks the
  // playhead on its start; the context-menu key opens the speed/split menu a right-click would.
  const onBlockKey = (event: KeyboardEvent<HTMLDivElement>, segment: ClipSegment): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(segment.id);
      onSeekSource(segment.start);

      return;
    }

    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;

    event.preventDefault();
    const r = event.currentTarget.getBoundingClientRect();
    openMenu(segment, r.left, r.bottom + 4, (segment.start + segment.end) / 2);
  };

  return (
    <div className="select-none pt-7">
      {/* Not overflow-hidden: the handles' time bubbles rise above the track, and a handle at the very
          start or end of the clip needs its hit area to reach past the track's edge. */}
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          onSeekSource(sourceAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse') setHoverPct((sourceAt(e.clientX) / total) * 100);
        }}
        onPointerLeave={() => {
          setHoverPct(null);
        }}
        className="relative h-16 cursor-pointer rounded-xl ring-1 ring-white/10 shadow-inner"
        style={{ background: 'linear-gradient(to bottom, oklch(0.26 0.02 280), oklch(0.18 0.02 280))' }}
      >
        {/* full-clip placeholder waveform (dim) — the trimmed-away regions show through here */}
        <div aria-hidden className="absolute inset-x-2 inset-y-0 flex items-center gap-px opacity-40">
          {WAVEFORM.map((h, i) => (
            <span key={i} className="flex-1 rounded-full bg-white/25" style={{ height: `${h}%` }} />
          ))}
        </div>

        {/* hover ghost line — where a click will drop the playhead */}
        {hoverPct !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white/35"
            style={{ left: `${hoverPct}%` }}
          />
        )}

        {/* kept segments — bright blocks on the dim placeholder, positioned by source time */}
        {segments.map((segment, index) => {
          const leftPct = (segment.start / total) * 100;
          const widthPct = ((segment.end - segment.start) / total) * 100;
          const selected = segment.id === selectedId;

          return (
            <div
              key={segment.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={t('edit.segment', {
                number: index + 1,
                start: fmtClock(segment.start),
                end: fmtClock(segment.end),
              })}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelect(segment.id);
                onSeekSource(sourceAt(e.clientX));
              }}
              onKeyDown={(e) => {
                onBlockKey(e, segment);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openMenu(segment, e.clientX, e.clientY, sourceAt(e.clientX));
              }}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              className={cn(
                'group absolute inset-y-1.5 min-w-0 overflow-visible rounded-lg ring-1 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                'bg-linear-to-b from-amber-400 to-amber-500 ring-amber-950/20',
                // The selected block sits above its neighbours so dragging an edge to extend it over an
                // adjacent segment stays visible (segments are independent source ranges and may overlap).
                selected ? 'z-30 ring-2 ring-brand-400 shadow-lg shadow-brand-500/30' : 'z-20 hover:ring-amber-300'
              )}
            >
              <div className="pointer-events-none flex h-full items-center justify-center gap-1.5 overflow-hidden px-2">
                <span className="truncate text-xs font-bold tabular-nums text-amber-950">
                  {Math.round((segment.end - segment.start) * 10) / 10}s
                </span>
                {segment.speed !== 1 && (
                  <span className="shrink-0 rounded bg-amber-950/15 px-1 text-[0.65rem] font-bold tabular-nums text-amber-950">
                    {segment.speed}×
                  </span>
                )}
              </div>

              {selected && (
                <>
                  <button
                    type="button"
                    aria-label={t('edit.segmentOptions')}
                    aria-haspopup="menu"
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                    }}
                    onClick={(ev) => {
                      const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                      openMenu(segment, r.left, r.bottom + 4, (segment.start + segment.end) / 2);
                    }}
                    className="absolute right-1 top-1 z-40 grid size-6 place-items-center rounded-md bg-amber-950/15 text-amber-950 transition-colors hover:bg-amber-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-950/60"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                  <TrimHandle
                    side="start"
                    segment={segment}
                    duration={total}
                    trackWidth={trackWidth}
                    onTrimStart={onTrimStart}
                    onTrim={onTrim}
                  />
                  <TrimHandle
                    side="end"
                    segment={segment}
                    duration={total}
                    trackWidth={trackWidth}
                    onTrimStart={onTrimStart}
                    onTrim={onTrim}
                  />
                </>
              )}
            </div>
          );
        })}

        {/* playhead */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 z-40" style={{ left: `${playPct}%` }}>
          <div className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-white shadow" />
          <div className="absolute inset-y-0 -ml-px w-0.5 rounded-full bg-white shadow-[0_0_0_1px_oklch(0_0_0_/_0.45)]" />
        </div>
      </div>

      {menu && (
        <SegmentMenu
          x={menu.x}
          y={menu.y}
          segment={menu.segment}
          canDelete={segments.length > 1}
          onSetSpeed={(speed) => {
            onSetSpeed(menu.segment.id, speed);
          }}
          onSplit={() => {
            onSplitAt(menu.sourceTime);
            setMenu(null);
          }}
          onDelete={() => {
            onDelete(menu.segment.id);
            setMenu(null);
          }}
          onClose={() => {
            setMenu(null);
          }}
        />
      )}
    </div>
  );
}

export default Timeline;
