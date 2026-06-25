// The left panel's cross-kind element list: one ordered, selectable row per visual element of the
// selected section (background layers, text, image overlays, animations), driven by ElementDescriptor.
// Each row mirrors the canvas selection ring (aria-pressed), and carries move-up / move-down / delete
// controls. This generalizes OverlayInspector's text-only list to descriptor-driven rows, reusing the
// same kind→icon mapping as AddElementMenu so the list and the add menu stay in agreement.
import { useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { Image, Square, Trash2, Type } from '@/presentation/components/icons';
import { ChevronDownIcon } from '@/presentation/components/icons/chevron-down';
import { ChevronUpIcon } from '@/presentation/components/icons/chevron-up';
import { SparklesIcon } from '@/presentation/components/icons/sparkles';
import { cn } from '@/lib/utils';
import type { ElementRef } from './useSectionSelection';
import type { ElementDescriptor } from './sectionElements';
import { CANVAS_DND_MIME } from './canvasDrop';

// Shared with AddElementMenu's KIND_ICON so list rows and add-menu items use the same glyph per kind.
const KIND_ICON: Record<ElementRef['kind'], ComponentType<{ className?: string }>> = {
  layer: Square,
  text: Type,
  image: Image,
  animation: SparklesIcon,
};

// Two refs point at the same element when both kind and index match.
const sameRef = (a: ElementRef, b: ElementRef | null): boolean => {
  if (b === null) return false;

  return a.kind === b.kind && a.index === b.index;
};

// Decode a dragged element-row payload (the same JSON the canvas drop reads), or null when the drag
// is not a reorderable element row.
function parseElementRowDrag(raw: string): { ref: ElementRef } | null {
  try {
    const payload = JSON.parse(raw) as { source?: string; ref?: ElementRef };

    if (payload.source === 'element-row' && payload.ref) return { ref: payload.ref };
  } catch {
    // Not a JSON element-row payload — ignore.
  }

  return null;
}

interface ElementListProps {
  elements: ElementDescriptor[];
  activeRef: ElementRef | null;
  onSelect: (ref: ElementRef) => void;
  onDelete: (ref: ElementRef) => void;
  onMove: (ref: ElementRef, delta: number) => void;
}

export const ElementList = ({ elements, activeRef, onSelect, onDelete, onMove }: ElementListProps) => {
  const { t } = useTranslation('admin');

  // Reorder is scoped per kind (text / image / animation / layer each live in their own array, and the
  // engine composites the kinds in a fixed order), so the move arrows must reflect each element's
  // position WITHIN its kind — not its index in the flattened list — or they read as enabled while
  // doing nothing (e.g. a lone text above a lone image).
  const countByKind = elements.reduce<Partial<Record<ElementRef['kind'], number>>>((acc, { kind }) => {
    acc[kind] = (acc[kind] ?? 0) + 1;

    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{t('element.list')}</span>
      {elements.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('element.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {elements.map((descriptor) => (
            <Row
              key={`${descriptor.kind}:${descriptor.ref.index}`}
              descriptor={descriptor}
              active={sameRef(descriptor.ref, activeRef)}
              first={descriptor.ref.index === 0}
              last={descriptor.ref.index === (countByKind[descriptor.kind] ?? 1) - 1}
              onSelect={onSelect}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

interface RowProps {
  descriptor: ElementDescriptor;
  active: boolean;
  first: boolean;
  last: boolean;
  onSelect: (ref: ElementRef) => void;
  onDelete: (ref: ElementRef) => void;
  onMove: (ref: ElementRef, delta: number) => void;
}

const Row = ({ descriptor, active, first, last, onSelect, onDelete, onMove }: RowProps) => {
  const { t } = useTranslation('admin');
  const Icon = KIND_ICON[descriptor.kind];
  const { ref } = descriptor;
  const { ref: chevronUpRef, hoverProps: chevronUpHoverProps } = useIconHover();
  const { ref: chevronDownRef, hoverProps: chevronDownHoverProps } = useIconHover();
  const [dropTarget, setDropTarget] = useState(false);

  // A row dragged onto ANOTHER row reorders the list (same kind only — kinds live in separate arrays).
  // The same draggable also feeds the canvas (effectAllowed copyMove), so dropping on the canvas still
  // adds the element; dropping on a row moves it.
  const onRowDrop = (event: React.DragEvent<HTMLLIElement>): void => {
    setDropTarget(false);
    const raw = event.dataTransfer.getData(CANVAS_DND_MIME);

    if (!raw) return;
    event.preventDefault();
    event.stopPropagation();

    const payload = parseElementRowDrag(raw);

    if (!payload || payload.ref.kind !== ref.kind) return;
    onMove(payload.ref, ref.index - payload.ref.index);
  };

  return (
    <li
      className={cn('flex items-center gap-1 rounded-lg', dropTarget && 'ring-2 ring-brand-500/50')}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'copyMove';
        event.dataTransfer.setData(CANVAS_DND_MIME, JSON.stringify({ source: 'element-row', ref }));
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(CANVAS_DND_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTarget(true);
      }}
      onDragLeave={() => {
        setDropTarget(false);
      }}
      onDrop={onRowDrop}
    >
      <button
        type="button"
        aria-pressed={active}
        onClick={() => {
          onSelect(ref);
        }}
        className={cn(
          'tap flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
          active ? 'bg-brand-500/15 text-foreground' : 'text-gray-600 hover:bg-foreground/5 dark:text-gray-300'
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
        <span className="shrink-0">{t(descriptor.labelKey, descriptor.labelParams)}</span>
        {descriptor.previewText && (
          <span className="truncate text-gray-400 dark:text-gray-500">{descriptor.previewText}</span>
        )}
      </button>
      <IconButton
        label={t('element.moveUp')}
        disabled={first}
        onClick={() => {
          onMove(ref, -1);
        }}
        hoverProps={chevronUpHoverProps}
      >
        <ChevronUpIcon ref={chevronUpRef} size={14} />
      </IconButton>
      <IconButton
        label={t('element.moveDown')}
        disabled={last}
        onClick={() => {
          onMove(ref, 1);
        }}
        hoverProps={chevronDownHoverProps}
      >
        <ChevronDownIcon ref={chevronDownRef} size={14} />
      </IconButton>
      <IconButton
        label={t('element.delete')}
        danger
        onClick={() => {
          onDelete(ref);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </IconButton>
    </li>
  );
};

interface IconButtonProps {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  hoverProps?: { onMouseEnter: () => void; onMouseLeave: () => void };
  children: ReactNode;
}

const IconButton = ({ label, disabled, danger, onClick, hoverProps, children }: IconButtonProps) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'tap rounded-lg p-1.5 text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 active:scale-90 disabled:pointer-events-none disabled:opacity-30',
      danger
        ? 'hover:bg-foreground/5 hover:text-[var(--color-error)] focus-visible:ring-[var(--color-error)]/40'
        : 'hover:bg-foreground/5 hover:text-foreground focus-visible:ring-brand-500/40'
    )}
    {...hoverProps}
  >
    {children}
  </button>
);
