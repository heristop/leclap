// The left panel's cross-kind element list: one ordered, selectable row per visual element of the
// selected section (background layers, text, image overlays, animations), driven by ElementDescriptor.
// Each row mirrors the canvas selection ring (aria-pressed), and carries move-up / move-down / delete
// controls. This generalizes OverlayInspector's text-only list to descriptor-driven rows, reusing the
// same kind→icon mapping as AddElementMenu so the list and the add menu stay in agreement.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  Image,
  Sparkles,
  Square,
  Trash2,
  Type,
  type LucideIcon,
} from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import type { ElementRef } from './useSectionSelection';
import type { ElementDescriptor } from './sectionElements';
import { CANVAS_DND_MIME } from './canvasDrop';

// Shared with AddElementMenu's KIND_ICON so list rows and add-menu items use the same glyph per kind.
const KIND_ICON: Record<ElementRef['kind'], LucideIcon> = {
  layer: Square,
  text: Type,
  image: Image,
  animation: Sparkles,
};

// Two refs point at the same element when both kind and index match.
const sameRef = (a: ElementRef, b: ElementRef | null): boolean => {
  if (b === null) return false;

  return a.kind === b.kind && a.index === b.index;
};

interface ElementListProps {
  elements: ElementDescriptor[];
  activeRef: ElementRef | null;
  onSelect: (ref: ElementRef) => void;
  onDelete: (ref: ElementRef) => void;
  onMove: (ref: ElementRef, delta: number) => void;
}

export const ElementList = ({ elements, activeRef, onSelect, onDelete, onMove }: ElementListProps) => {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{t('element.list')}</span>
      {elements.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('element.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {elements.map((descriptor, index) => (
            <Row
              key={`${descriptor.kind}:${descriptor.ref.index}`}
              descriptor={descriptor}
              active={sameRef(descriptor.ref, activeRef)}
              first={index === 0}
              last={index === elements.length - 1}
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

  return (
    <li
      className="flex items-center gap-1"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(CANVAS_DND_MIME, JSON.stringify({ source: 'element-row', ref }));
      }}
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
        <span className="truncate">{t(descriptor.labelKey, descriptor.labelParams)}</span>
      </button>
      <IconButton
        label={t('element.moveUp')}
        disabled={first}
        onClick={() => {
          onMove(ref, -1);
        }}
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        label={t('element.moveDown')}
        disabled={last}
        onClick={() => {
          onMove(ref, 1);
        }}
      >
        <ChevronDown className="h-3.5 w-3.5" />
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
  children: ReactNode;
}

const IconButton = ({ label, disabled, danger, onClick, children }: IconButtonProps) => (
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
  >
    {children}
  </button>
);
