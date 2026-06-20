// The left-panel text-overlay editor: controls ONLY (no canvas). It lists the section's text overlays,
// adds new ones, and — for the one selected on the center SectionCanvas — surfaces the font/size/color/
// box controls. Selection is shared with the canvas via `selection` + `onSelectText`, so picking a row
// here highlights it on the preview and selecting on the preview reveals its controls here.
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Type } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { newOverlay, type TextOverlay } from '../templateEditorModel';
import type { SectionSelectionState } from './useSectionSelection';
import { SelectedControls } from './overlayControls';

interface OverlayInspectorProps {
  overlays: TextOverlay[];
  variables: string[];
  selection: SectionSelectionState;
  onSelectText: (index: number | null) => void;
  onChange: (overlays: TextOverlay[]) => void;
}

// Replace one overlay in a fresh array (immutable update for onChange).
const withOverlay = (overlays: TextOverlay[], index: number, patch: Partial<TextOverlay>): TextOverlay[] =>
  overlays.map((o, i) => (i === index ? { ...o, ...patch } : o));

export const OverlayInspector = ({ overlays, variables, selection, onSelectText, onChange }: OverlayInspectorProps) => {
  const { t } = useTranslation('admin');
  const activeIndex = selection.element?.kind === 'text' ? selection.element.index : null;

  const addText = () => {
    const index = overlays.length;
    onChange([...overlays, newOverlay()]);
    onSelectText(index);
  };

  const removeAt = (index: number) => {
    onSelectText(null);
    onChange(overlays.filter((_, i) => i !== index));
  };

  const patchActive = (patch: Partial<TextOverlay>) => {
    if (activeIndex === null) return;
    onChange(withOverlay(overlays, activeIndex, patch));
  };

  const insertVariable = (name: string) => {
    if (activeIndex === null) return;
    const current = overlays[activeIndex].text;
    onChange(withOverlay(overlays, activeIndex, { text: `${current}{{ ${name} }}` }));
  };

  const selected = activeIndex === null ? null : overlays[activeIndex];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{t('overlay.list')}</span>
        <button
          type="button"
          onClick={addText}
          className="tap inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] dark:text-gray-300"
        >
          <Plus className="h-3.5 w-3.5" /> {t('overlay.addText')}
        </button>
      </div>
      <OverlayList
        overlays={overlays}
        activeIndex={activeIndex}
        labelFor={(overlay, index) => overlayRowLabel(overlay, index, t)}
        emptyLabel={t('overlay.empty')}
        deleteLabel={t('overlay.deleteText')}
        onSelect={onSelectText}
        onDelete={removeAt}
      />
      {selected ? (
        <div className="rounded-xl border border-foreground/10 bg-surface-2/50 p-3">
          <SelectedControls
            overlay={selected}
            t={t}
            variables={variables}
            onPatch={patchActive}
            onInsertVariable={insertVariable}
            onDelete={() => {
              if (activeIndex !== null) removeAt(activeIndex);
            }}
          />
        </div>
      ) : (
        overlays.length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{t('overlay.selectHint')}</p>
      )}
    </div>
  );
};

interface OverlayListProps {
  overlays: TextOverlay[];
  activeIndex: number | null;
  labelFor: (overlay: TextOverlay, index: number) => string;
  emptyLabel: string;
  deleteLabel: string;
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
}

// A compact, keyboard-selectable list of the section's text overlays. The active row mirrors the
// canvas selection ring.
const OverlayList = ({
  overlays,
  activeIndex,
  labelFor,
  emptyLabel,
  deleteLabel,
  onSelect,
  onDelete,
}: OverlayListProps) => {
  if (overlays.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-1">
      {overlays.map((overlay, index) => (
        <li key={index} className="flex items-center gap-1">
          <button
            type="button"
            aria-pressed={index === activeIndex}
            onClick={() => {
              onSelect(index);
            }}
            className={cn(
              'tap flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
              index === activeIndex
                ? 'bg-brand-500/15 text-foreground'
                : 'text-gray-600 hover:bg-foreground/5 dark:text-gray-300'
            )}
          >
            <Type className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
            <span className="truncate">{labelFor(overlay, index)}</span>
          </button>
          <button
            type="button"
            aria-label={deleteLabel}
            onClick={() => {
              onDelete(index);
            }}
            className="tap rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-foreground/5 hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
};

// A readable row label: the overlay's trimmed text, else "Text N".
function overlayRowLabel(overlay: TextOverlay, index: number, t: ReturnType<typeof useTranslation>['t']): string {
  const text = overlay.text.trim();

  return text === '' ? t('overlay.untitled', { index: index + 1 }) : text;
}
