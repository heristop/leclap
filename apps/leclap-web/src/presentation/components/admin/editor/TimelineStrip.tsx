// A horizontal overview strip at the top of the editor: one proportional-width chip per VISUAL
// section (color swatch / image / video glyph), widths ∝ section duration, with the boundary
// transition glyph rendered between chips. Clicking (or Enter on) a chip scrolls its section card
// into view; Alt+Arrow reorders. Gives the "what will my video look like" overview the vertical
// card list lacks. Reorder/scroll are delegated to the parent through callbacks so all state stays
// in the history-backed editor.
import { useState, Fragment, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Square, Image as ImageIcon, Video as VideoIcon, Scissors, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorState } from '../templateEditorModel';
import { computeTimeline, type TimelineChip, type TimelineKind } from './timelineLayout';
import { transitionLabel } from './transitionGroups';

interface TimelineStripProps {
  state: EditorState;
  // Scroll the section card at the given editor index into view + focus it.
  onScrollToSection: (editorIndex: number) => void;
  // Move the section at `from` to `to` (editor indices).
  onReorder: (from: number, to: number) => void;
}

const KIND_ICON: Record<TimelineKind, typeof Square> = {
  color: Square,
  image: ImageIcon,
  video: VideoIcon,
};

export const TimelineStrip = ({ state, onScrollToSection, onReorder }: TimelineStripProps) => {
  const { t } = useTranslation('admin');
  const chips = computeTimeline(state);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  // The strip is an overview of how visual scenes flow into each other — it only earns its space
  // once there are at least two to compare. A single scene is self-evident from its card.
  if (chips.length < 2) return null;

  const move = (chipIndex: number, delta: number): void => {
    const target = chipIndex + delta;

    if (target < 0 || target >= chips.length) return;

    onReorder(chips[chipIndex].editorIndex, chips[target].editorIndex);
  };

  return (
    <div className="mb-6">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('timeline.label')}
      </span>
      <div
        role="list"
        aria-label={t('timeline.ariaLabel')}
        className="flex items-stretch gap-0.5 overflow-hidden rounded-xl border border-foreground/10 bg-surface-2/40 p-1.5"
      >
        {chips.map((chip, i) => (
          <Fragment key={chip.editorIndex}>
            <TimelineChipButton
              chip={chip}
              t={t}
              position={i}
              count={chips.length}
              dragging={dragFrom === i}
              onActivate={() => {
                onScrollToSection(chip.editorIndex);
              }}
              onMove={(delta) => {
                move(i, delta);
              }}
              onDragStart={() => {
                setDragFrom(i);
              }}
              onDropOn={() => {
                if (dragFrom !== null && dragFrom !== i) {
                  onReorder(chips[dragFrom].editorIndex, chip.editorIndex);
                }
                setDragFrom(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
              }}
            />
            {chip.transitionAfter && i < chips.length - 1 && (
              <span
                aria-hidden
                title={transitionLabel(chip.transitionAfter.type, chip.transitionAfter.duration, t)}
                className="grid shrink-0 place-items-center px-0.5 text-brand-500"
              >
                <Sparkles className="h-3 w-3" />
              </span>
            )}
            {!chip.transitionAfter && i < chips.length - 1 && (
              <span aria-hidden className="grid shrink-0 place-items-center px-0.5 text-gray-400">
                <Scissors className="h-3 w-3" />
              </span>
            )}
          </Fragment>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{t('timeline.hint')}</p>
    </div>
  );
};

interface ChipButtonProps {
  chip: TimelineChip;
  t: TFunction<'admin'>;
  position: number;
  count: number;
  dragging: boolean;
  onActivate: () => void;
  onMove: (delta: number) => void;
  onDragStart: () => void;
  onDropOn: () => void;
  onDragEnd: () => void;
}

const TimelineChipButton = ({
  chip,
  t,
  position,
  count,
  dragging,
  onActivate,
  onMove,
  onDragStart,
  onDropOn,
  onDragEnd,
}: ChipButtonProps) => {
  const Icon = KIND_ICON[chip.kind];

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      onMove(-1);

      return;
    }

    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      onMove(1);
    }
  };

  return (
    <button
      type="button"
      role="listitem"
      draggable
      aria-label={t('timeline.chip', {
        kind: t(`timeline.kind.${chip.kind}`),
        position: position + 1,
        count,
      })}
      style={{ width: `${chip.widthPct}%` }}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      onDragStart={(e: DragEvent<HTMLButtonElement>) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(e: DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
      }}
      onDrop={(e: DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        onDropOn();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative grid h-12 min-w-8 place-items-center overflow-hidden rounded-md border text-white transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
        dragging ? 'scale-95 opacity-50' : 'hover:brightness-110',
        chip.kind === 'color' ? 'border-black/10' : 'border-foreground/10 bg-foreground/10'
      )}
    >
      {chip.kind === 'color' && (
        <span aria-hidden className="absolute inset-0" style={{ backgroundColor: chip.color }} />
      )}
      <Icon
        className={cn(
          'relative h-4 w-4 drop-shadow',
          chip.kind === 'color' ? 'text-white/90' : 'text-brand-700 dark:text-brand-200'
        )}
      />
    </button>
  );
};
