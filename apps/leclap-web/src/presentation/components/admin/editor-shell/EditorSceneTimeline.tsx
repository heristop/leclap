import { Fragment, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Trash2 } from '@/presentation/components/icons';
import { SceneCell } from '@/presentation/components/editor-shell';
import { SECTION_ICON, type SectionKind } from '@/lib/sectionMeta';
import type { EditorSection, SectionTransition } from '../templateEditorModel';
import { TransitionPicker } from '../editor/TransitionPicker';
import { AddSceneMenu } from './AddSceneMenu';

interface EditorSceneTimelineProps {
  sections: EditorSection[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAdd: (kind: SectionKind) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onTransition: (index: number, transition: SectionTransition | undefined) => void;
  sectionTitle: (section: EditorSection, index: number) => string;
  sectionKindLabel: (section: EditorSection) => string;
}

const VISUAL_KINDS: ReadonlySet<EditorSection['kind']> = new Set(['video', 'color', 'image']);

// True when section `i` is visual AND some later section is visual too — the boundary that earns a
// transition control. The last visual section never gets one (the validator rejects a dangling one).
const hasVisualAfter = (sections: EditorSection[], i: number): boolean =>
  VISUAL_KINDS.has(sections[i].kind) && sections.slice(i + 1).some((s) => VISUAL_KINDS.has(s.kind));

// The bottom scene lane for the template editor: one SceneCell per section in order, drag-reorderable
// (same native HTML5 drag-from/drop-on mechanism as TimelineStrip), with per-cell duplicate/delete on
// the active cell, inline transition pickers between visual sections, and a kind picker to add scenes.
export const EditorSceneTimeline = ({
  sections,
  selectedIndex,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onReorder,
  onTransition,
  sectionTitle,
  sectionKindLabel,
}: EditorSceneTimelineProps) => {
  const { t } = useTranslation('admin');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const canDelete = sections.length > 1;

  const dropOn = (to: number): void => {
    if (dragFrom !== null && dragFrom !== to) onReorder(dragFrom, to);
    setDragFrom(null);
  };

  return (
    <div
      role="toolbar"
      aria-label={t('shell.scenes')}
      className="track-edge-fade flex flex-1 items-stretch gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:thin]"
    >
      {sections.map((section, i) => (
        <Fragment key={i}>
          <div
            draggable
            onDragStart={(e: DragEvent<HTMLDivElement>) => {
              e.dataTransfer.effectAllowed = 'move';
              setDragFrom(i);
            }}
            onDragOver={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
            }}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              dropOn(i);
            }}
            onDragEnd={() => {
              setDragFrom(null);
            }}
            className={dragFrom === i ? 'opacity-50' : undefined}
          >
            <SceneCell
              index={i}
              role="button"
              title={sectionTitle(section, i)}
              eyebrow={sectionKindLabel(section)}
              icon={SECTION_ICON[section.kind]}
              active={i === selectedIndex}
              tabIndex={i === selectedIndex ? 0 : -1}
              onSelect={() => {
                onSelect(i);
              }}
              trailing={
                i === selectedIndex ? (
                  <CellActions
                    canDelete={canDelete}
                    onDuplicate={() => {
                      onDuplicate(i);
                    }}
                    onDelete={() => {
                      onDelete(i);
                    }}
                    t={t}
                  />
                ) : undefined
              }
            />
          </div>
          {dragFrom === null && hasVisualAfter(sections, i) && (
            <span className="grid shrink-0 place-items-center" aria-label={t('shell.transitionAfter')}>
              <TransitionPicker
                transition={'transitionAfter' in section ? section.transitionAfter : undefined}
                onChange={(transition) => {
                  onTransition(i, transition);
                }}
              />
            </span>
          )}
        </Fragment>
      ))}
      <AddSceneMenu onAdd={onAdd} />
    </div>
  );
};

interface CellActionsProps {
  canDelete: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}

// Duplicate + delete affordances overlaid on the active cell via SceneCell's `trailing` slot.
const CellActions = ({ canDelete, onDuplicate, onDelete, t }: CellActionsProps) => (
  <div className="absolute right-1.5 top-1.5 z-10 flex gap-1">
    <button
      type="button"
      aria-label={t('shell.duplicateScene')}
      onClick={onDuplicate}
      className="tap grid size-6 place-items-center rounded-md bg-black/55 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
    >
      <Copy className="size-3.5" />
    </button>
    <button
      type="button"
      aria-label={t('shell.deleteScene')}
      disabled={!canDelete}
      onClick={onDelete}
      className="tap grid size-6 place-items-center rounded-md bg-black/55 text-white transition-colors hover:bg-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/60 disabled:pointer-events-none disabled:opacity-40"
    >
      <Trash2 className="size-3.5" />
    </button>
  </div>
);
