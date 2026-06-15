import { useState, Fragment, type DragEvent } from 'react';
import {
  GripVertical,
  Trash2,
  Copy,
  ArrowDown,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Video as VideoIcon,
  Square,
  FileText,
  Music,
  Image as ImageIcon,
  Braces,
} from 'lucide-react';
import clsx from 'clsx';
import type { AvailablePartial } from '@/services/templatePartialService';
import {
  SECTION_LABELS,
  type BackgroundLayer,
  type EditorSection,
  type EditorState,
  type SectionTransition,
} from '../templateEditorModel';
import { TransitionPicker } from './TransitionPicker';
import { SectionFields } from './SectionFields';
import { errorsForEditorSection, type SectionValidation, type ValidationError } from './validationMapping';
import { SECTION_HINTS } from './sectionHints';
import { EDITOR_INPUT_CLASS } from './editorStyles';
import { SECTION_CATEGORY, type SectionCategory } from '@/lib/sectionMeta';

const VISUAL_KINDS: ReadonlySet<EditorSection['kind']> = new Set(['video', 'color', 'image']);

const isVisual = (section: EditorSection): boolean => VISUAL_KINDS.has(section.kind);

interface SceneListProps {
  sections: EditorSection[];
  orientation: EditorState['orientation'];
  variables: string[];
  dragIndex: number | null;
  validation: SectionValidation;
  editorState: EditorState;
  partials: AvailablePartial[];
  setDragIndex: (i: number | null) => void;
  reorder: (from: number, to: number) => void;
  removeSection: (i: number) => void;
  duplicateSection: (i: number) => void;
  patchSection: (i: number, p: Partial<EditorSection>) => void;
  setTransition: (i: number, transition: SectionTransition | undefined) => void;
  setLayers: (i: number, layers: BackgroundLayer[]) => void;
  getSectionDomId?: (index: number) => string;
}

// True when section `i` is visual AND some later section is also visual. The last
// visual section never gets a transition chip because the validator rejects it.
const hasVisualAfter = (sections: EditorSection[], i: number): boolean =>
  isVisual(sections[i]) && sections.slice(i + 1).some(isVisual);

// Move a collapsed index `from` -> `to` within the set, shifting the indices in
// between, so per-card collapsed state follows the card across a reorder.
const remapCollapsed = (collapsed: Set<number>, from: number, to: number): Set<number> => {
  const next = new Set<number>();

  for (const idx of collapsed) {
    if (idx === from) {
      next.add(to);

      continue;
    }

    if (from < idx && idx <= to) {
      next.add(idx - 1);

      continue;
    }

    if (to <= idx && idx < from) {
      next.add(idx + 1);

      continue;
    }

    next.add(idx);
  }

  return next;
};

export const SceneList = ({
  sections,
  orientation,
  variables,
  dragIndex,
  validation,
  editorState,
  partials,
  setDragIndex,
  reorder,
  removeSection,
  duplicateSection,
  patchSection,
  setTransition,
  setLayers,
  getSectionDomId,
}: SceneListProps) => {
  // `insertAt` is the gap index (0..n) where the dragged card will land.
  const [insertAt, setInsertAt] = useState<number | null>(null);
  // Only arm `draggable` once the grip handle is pressed, so clicks/inputs inside
  // the card body stay fully interactive.
  const [armedIndex, setArmedIndex] = useState<number | null>(null);
  // Collapsed cards, keyed by index. UI-only and remapped on reorder.
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const dragging = dragIndex !== null;
  const allCollapsed = sections.length > 0 && collapsed.size === sections.length;

  const toggleCollapsed = (i: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);

      if (next.has(i)) {
        next.delete(i);

        return next;
      }
      next.add(i);

      return next;
    });
  };

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsed(new Set());

      return;
    }
    setCollapsed(new Set(sections.map((_, idx) => idx)));
  };

  const handleRemove = (i: number) => {
    setCollapsed((prev) => {
      const next = new Set<number>();

      for (const idx of prev) {
        if (idx === i) continue;

        next.add(idx > i ? idx - 1 : idx);
      }

      return next;
    });
    removeSection(i);
  };

  const commit = (at: number) => {
    if (dragIndex !== null) {
      const target = dragIndex < at ? at - 1 : at;

      if (target !== dragIndex) {
        setCollapsed((prev) => remapCollapsed(prev, dragIndex, target));
        reorder(dragIndex, target);
      }
    }
    setDragIndex(null);
    setInsertAt(null);
  };

  const onItemDragOver = (i: number, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const at = e.clientY < rect.top + rect.height / 2 ? i : i + 1;

    if (insertAt !== at) setInsertAt(at);
  };

  const dropZone = (at: number) => (
    <div
      onDragOver={(e) => {
        e.preventDefault();

        if (insertAt !== at) setInsertAt(at);
      }}
      onDrop={() => {
        commit(at);
      }}
      className={clsx(
        'grid transition-all duration-200 ease-[var(--ease-out-expo)]',
        dragging && insertAt === at ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      )}
    >
      <div className="overflow-hidden">
        <div className="my-2 grid h-16 place-items-center rounded-xl border-2 border-dashed border-brand-500/60 bg-brand-500/[0.08]">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">
            <ArrowDown className="w-4 h-4 animate-bounce" /> Drop here
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mb-4">
      {sections.length > 1 && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={toggleAll}
            aria-pressed={allCollapsed}
            className="tap inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 transition-colors hover:bg-foreground/5 hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97]"
          >
            {allCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>
      )}
      {sections.length === 0 && (
        <div className="grid place-items-center rounded-xl border-2 border-dashed border-foreground/15 bg-foreground/[0.02] px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No scenes yet — add your first one below.
        </div>
      )}
      {sections.map((section, i) => (
        <Fragment key={i}>
          {dropZone(i)}
          <SectionCard
            section={section}
            orientation={orientation}
            variables={variables}
            index={i}
            id={getSectionDomId?.(i)}
            armed={armedIndex === i}
            dragging={dragIndex === i}
            collapsed={collapsed.has(i)}
            insertAt={insertAt}
            errors={errorsForEditorSection(validation, editorState, i)}
            partials={partials}
            setArmedIndex={setArmedIndex}
            setDragIndex={setDragIndex}
            setInsertAt={setInsertAt}
            onItemDragOver={onItemDragOver}
            commit={commit}
            toggleCollapsed={toggleCollapsed}
            removeSection={handleRemove}
            duplicateSection={duplicateSection}
            patchSection={patchSection}
            setLayers={setLayers}
          />
          {!dragging && hasVisualAfter(sections, i) && (
            <TransitionPicker
              transition={'transitionAfter' in section ? section.transitionAfter : undefined}
              onChange={(transition) => {
                setTransition(i, transition);
              }}
            />
          )}
        </Fragment>
      ))}
      {dropZone(sections.length)}
    </div>
  );
};

interface SectionCardProps {
  section: EditorSection;
  orientation: EditorState['orientation'];
  variables: string[];
  index: number;
  id: string | undefined;
  armed: boolean;
  dragging: boolean;
  collapsed: boolean;
  insertAt: number | null;
  errors: ValidationError[];
  partials: AvailablePartial[];
  setArmedIndex: (i: number | null) => void;
  setDragIndex: (i: number | null) => void;
  setInsertAt: (i: number | null) => void;
  onItemDragOver: (i: number, e: DragEvent<HTMLDivElement>) => void;
  commit: (at: number) => void;
  toggleCollapsed: (i: number) => void;
  removeSection: (i: number) => void;
  duplicateSection: (i: number) => void;
  patchSection: (i: number, p: Partial<EditorSection>) => void;
  setLayers: (i: number, layers: BackgroundLayer[]) => void;
}

const SectionCard = ({
  section,
  orientation,
  variables,
  index,
  id,
  armed,
  dragging,
  collapsed,
  insertAt,
  errors,
  partials,
  setArmedIndex,
  setDragIndex,
  setInsertAt,
  onItemDragOver,
  commit,
  toggleCollapsed,
  removeSection,
  duplicateSection,
  patchSection,
  setLayers,
}: SectionCardProps) => (
  <div
    id={id}
    tabIndex={-1}
    draggable={armed}
    onDragStart={(e) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = 'move';
    }}
    onDragOver={(e) => {
      onItemDragOver(index, e);
    }}
    onDrop={() => {
      commit(insertAt ?? index);
    }}
    onDragEnd={() => {
      setDragIndex(null);
      setInsertAt(null);
      setArmedIndex(null);
    }}
    className={clsx(
      'relative my-2 rounded-xl border bg-surface-2/60 p-3 transition-all duration-200 ease-[var(--ease-out-expo)] scroll-mt-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
      dragging &&
        'scale-[0.98] rotate-[0.5deg] cursor-grabbing border-dashed border-brand-500/50 opacity-50 shadow-lg shadow-brand-500/20',
      !dragging && errors.length > 0 && 'border-[var(--color-error)]/60 ring-1 ring-[var(--color-error)]/30',
      !dragging && errors.length === 0 && 'border-foreground/10'
    )}
  >
    <div className={clsx('flex items-center gap-2', collapsed ? 'mb-0' : 'mb-2')}>
      <button
        type="button"
        className="cursor-grab rounded-md text-gray-500 transition-all hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:cursor-grabbing active:scale-125"
        aria-label="Drag to reorder"
        onPointerDown={() => {
          setArmedIndex(index);
        }}
        onPointerUp={() => {
          setArmedIndex(null);
        }}
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => {
          toggleCollapsed(index);
        }}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand section' : 'Collapse section'}
        className="rounded-md text-gray-500 transition-colors hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-90"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      <span
        className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-500/15 text-[11px] font-bold tabular-nums text-brand-700 dark:text-brand-300"
        aria-hidden
      >
        {index + 1}
      </span>
      <SectionIcon kind={section.kind} />
      <span className="shrink-0 text-sm font-semibold text-foreground">{SECTION_LABELS[section.kind]}</span>
      {collapsed && (
        <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">{sectionSummary(section)}</span>
      )}
      <div className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => {
            duplicateSection(index);
          }}
          aria-label="Duplicate section"
          className="tap rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-foreground/5 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-90 dark:hover:text-brand-300"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            removeSection(index);
          }}
          aria-label="Remove section"
          className="tap rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-foreground/5 hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
    {!collapsed && (
      <SectionFields
        section={section}
        orientation={orientation}
        variables={variables}
        partials={partials}
        onChange={(p) => {
          patchSection(index, p);
        }}
        onLayers={(layers) => {
          setLayers(index, layers);
        }}
        inputCls={EDITOR_INPUT_CLASS}
      />
    )}
    {errors.length > 0 && (
      <ul className="mt-2 space-y-1 rounded-lg bg-[var(--color-error)]/10 px-3 py-2 text-xs font-medium text-[var(--color-error)]">
        {errors.map((e, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <AlertCircle className="mt-px size-3.5 shrink-0" /> {e.message}
          </li>
        ))}
      </ul>
    )}
  </div>
);

const DEFAULT_SECTION_BUTTONS: readonly EditorSection['kind'][] = [
  'video',
  'form',
  'color',
  'music',
  'image',
  'partial',
];

// Group the six section types under category labels instead of one flat list of buttons.
const CATEGORY_ORDER: readonly SectionCategory[] = ['clip', 'input', 'data'];
const CATEGORY_LABELS: Record<SectionCategory, string> = {
  clip: 'Clips & visuals',
  input: 'Input',
  data: 'Data',
};

const AddSectionButton = ({
  kind,
  onAdd,
}: {
  kind: EditorSection['kind'];
  onAdd: (kind: EditorSection['kind']) => void;
}) => (
  <button
    type="button"
    onClick={() => {
      onAdd(kind);
    }}
    className="tap group flex min-h-10 items-start gap-2.5 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.99]"
  >
    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-brand-500/10 transition-colors group-hover:bg-brand-500/15">
      <SectionIcon kind={kind} />
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-foreground">{SECTION_LABELS[kind]}</span>
      <span className="block text-xs text-gray-500 dark:text-gray-400">{SECTION_HINTS[kind]}</span>
    </span>
  </button>
);

export const AddSectionButtons = ({
  addSection,
  kinds = DEFAULT_SECTION_BUTTONS,
}: {
  addSection: (kind: EditorSection['kind']) => void;
  kinds?: readonly EditorSection['kind'][];
}) => (
  <div className="mb-6 space-y-4">
    <span className="block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
      Add a scene
    </span>
    {CATEGORY_ORDER.map((category) => {
      const inCategory = kinds.filter((kind) => SECTION_CATEGORY[kind] === category);

      if (inCategory.length === 0) return null;

      return (
        <div key={category} className="space-y-2">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {CATEGORY_LABELS[category]}
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {inCategory.map((kind) => (
              <AddSectionButton key={kind} kind={kind} onAdd={addSection} />
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

function videoSummary(section: Extract<EditorSection, { kind: 'video' }>): string {
  const parts = [`${section.duration}s`];

  if (section.mute) parts.push('muted');

  if (section.overlays.length > 0) parts.push(plural(section.overlays.length, 'overlay'));

  if (section.countdown) parts.push(`countdown ${section.countdownSeconds}s`);

  return parts.join(' · ');
}

function sectionSummary(section: EditorSection): string {
  if (section.kind === 'color') return `${section.duration}s · ${section.color}`;

  if (section.kind === 'form') return plural(section.fields.length, 'field');

  if (section.kind === 'music') {
    return plural(section.allowed.length, 'track') + (section.allowUpload ? ' · upload' : '');
  }

  if (section.kind === 'partial') {
    return `${section.ref || 'Unselected'}${section.prefix ? ` · ${section.prefix}` : ''}`;
  }

  if (section.kind === 'image') {
    return `${section.duration}s · ${plural(section.allowed.length, 'image')}${section.allowUpload ? ' · upload' : ''}`;
  }

  return videoSummary(section);
}

const SectionIcon = ({ kind }: { kind: EditorSection['kind'] }) => {
  if (kind === 'form') return <FileText className="w-4 h-4 text-brand-700 dark:text-brand-300" />;

  if (kind === 'color') return <Square className="w-4 h-4 text-secondary-700 dark:text-secondary-300" />;

  if (kind === 'music') return <Music className="w-4 h-4 text-brand-700 dark:text-brand-300" />;

  if (kind === 'image') return <ImageIcon className="w-4 h-4 text-secondary-700 dark:text-secondary-300" />;

  if (kind === 'partial') return <Braces className="w-4 h-4 text-secondary-700 dark:text-secondary-300" />;

  return <VideoIcon className="w-4 h-4 text-brand-700 dark:text-brand-300" />;
};
