import { useState, useId, Fragment, type DragEvent } from 'react';
import {
  GripVertical,
  Trash2,
  Plus,
  ArrowLeft,
  Video as VideoIcon,
  Square,
  FileText,
  Music,
  Image as ImageIcon,
  Save,
  ArrowDown,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Volume2,
  VolumeX,
} from 'lucide-react';
import clsx from 'clsx';
import { templateService, type Template } from '@/services/templateService';
import { userTemplateService } from '@/services/userTemplateService';
import {
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  ColorPicker,
} from '@/presentation/components/ui';
import {
  buildDescriptor,
  collectVariables,
  newSection,
  SECTION_LABELS,
  toEditorState,
  type EditorSection,
  type EditorState,
} from './templateEditorModel';
import { MediaPicker } from './MediaPicker';
import { OverlayCanvas } from './OverlayCanvas';

export { buildDescriptor } from './templateEditorModel';

interface TemplateEditorProps {
  initial: Template | null;
  onSaved: () => void;
  onCancel: () => void;
}

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-surface-2 border border-foreground/10 text-foreground placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all';

// Add `id` if absent, drop it if present — pure shortlist toggle.
const toggleId = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export const TemplateEditor = ({ initial, onSaved, onCancel }: TemplateEditorProps) => {
  const [state, setState] = useState<EditorState>(() => toEditorState(initial));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const variables = collectVariables(state);

  const patch = (p: Partial<EditorState>) => {
    setState((s) => ({ ...s, ...p }));
  };
  const patchSection = (i: number, p: Partial<EditorSection>) => {
    setState((s) => ({
      ...s,
      sections: s.sections.map((sec, idx) => (idx === i ? ({ ...sec, ...p } as EditorSection) : sec)),
    }));
  };
  const addSection = (kind: EditorSection['kind']) => {
    setState((s) => ({ ...s, sections: [...s.sections, newSection(kind)] }));
  };
  const removeSection = (i: number) => {
    setState((s) => ({ ...s, sections: s.sections.filter((_, idx) => idx !== i) }));
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setState((s) => {
      const next = [...s.sections];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      return { ...s, sections: next };
    });
  };

  const handleSave = () => {
    setError('');

    if (state.name.trim() === '') {
      setError('Give your template a name.');

      return;
    }

    if (state.sections.length === 0) {
      setError('Add at least one section.');

      return;
    }

    const emptyMedia = state.sections.find(
      (s) => (s.kind === 'music' || s.kind === 'image') && s.allowed.length === 0 && !s.allowUpload
    );

    if (emptyMedia) {
      const label = emptyMedia.kind === 'music' ? 'Background music' : 'Background image';
      setError(`Pick at least one option for the ${label} section, or allow uploads.`);

      return;
    }

    const descriptor = buildDescriptor(state);
    const template: Template = {
      id: state.id,
      name: state.name.trim(),
      description: state.description.trim(),
      orientation: state.orientation,
      hasForm: templateService.extractFormFields(descriptor).length > 0,
      complexity: templateService.getTemplateComplexity(descriptor),
      source: 'user',
      descriptor,
    };

    try {
      userTemplateService.save(template);
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save the template.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 pt-24 pb-28">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="group mb-4 -ml-2 rounded-full px-3 text-gray-500 hover:text-foreground dark:text-gray-400"
        >
          <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1" /> Templates
        </Button>

        <h2 className="text-3xl font-bold font-display text-foreground mb-1">
          {initial ? 'Edit template' : 'Create a template'}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
          Compose sections, then save — it appears in the builder as a Custom template.
        </p>

        <MetadataFields state={state} patch={patch} />

        {/* Sections (drag to reorder) */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Sections — drag to reorder
          </span>
        </div>
        <SectionList
          sections={state.sections}
          orientation={state.orientation}
          variables={variables}
          dragIndex={dragIndex}
          setDragIndex={setDragIndex}
          reorder={reorder}
          removeSection={removeSection}
          patchSection={patchSection}
        />

        <AddSectionButtons addSection={addSection} />

        {error && (
          <p
            role="alert"
            className="fade-in mb-4 flex items-start gap-2 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3.5 py-2.5 text-sm font-medium text-[var(--color-error)]"
          >
            <AlertCircle className="mt-px size-4 shrink-0" /> {error}
          </p>
        )}

        {/* Sticky action bar so Save stays reachable on long templates. */}
        <div className="sticky bottom-0 -mx-4 mt-6 flex gap-3 border-t border-foreground/10 bg-background/85 px-4 py-4 backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="primary" onClick={handleSave} className="min-h-11 flex-1 active:scale-[0.98]">
            <Save className="w-5 h-5" /> Save template
          </Button>
          <Button variant="secondary" onClick={onCancel} className="min-h-11 px-6 active:scale-[0.98]">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

interface MetadataFieldsProps {
  state: EditorState;
  patch: (p: Partial<EditorState>) => void;
}

const MetadataFields = ({ state, patch }: MetadataFieldsProps) => {
  const nameId = useId();

  return (
    <div className="mb-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={nameId} className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            Name
          </label>
          <input
            id={nameId}
            className={inputCls}
            value={state.name}
            onChange={(e) => {
              patch({ name: e.target.value });
            }}
            placeholder="My template"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            Orientation
          </label>
          <Select
            value={state.orientation}
            onValueChange={(v) => {
              patch({ orientation: v as EditorState['orientation'] });
            }}
          >
            <SelectTrigger aria-label="Orientation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="landscape">Landscape (16:9)</SelectItem>
              <SelectItem value="portrait">Portrait (9:16)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <AudioMixEditor state={state} patch={patch} />
      <GlobalVariablesEditor state={state} patch={patch} />
    </div>
  );
};

// Global audio mix: balances the recorded clips' own audio against the background music.
// Each slider is 0..1; dragging to 0 mutes that source (buildDescriptor writes
// global.audioVolumeLevel / global.musicVolumeLevel).
const AudioMixEditor = ({ state, patch }: MetadataFieldsProps) => {
  const { audioMix } = state;

  const setMix = (p: Partial<EditorState['audioMix']>) => {
    patch({ audioMix: { ...audioMix, ...p } });
  };

  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400">Audio mix</span>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        Balance your recorded clip against the music. Slide to 0 to mute.
      </p>
      <div className="space-y-3 rounded-xl border border-foreground/10 bg-surface/40 p-3">
        <VolumeSlider
          label="Your video"
          value={audioMix.video}
          onChange={(video) => {
            setMix({ video });
          }}
        />
        <VolumeSlider
          label="Music"
          value={audioMix.music}
          onChange={(music) => {
            setMix({ music });
          }}
        />
      </div>
    </div>
  );
};

interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const VolumeSlider = ({ label, value, onChange }: VolumeSliderProps) => {
  const muted = value === 0;

  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs font-medium">
        <span className="flex items-center gap-1.5 text-foreground/80">
          {muted ? <VolumeX className="size-3.5 text-[var(--color-error)]" /> : <Volume2 className="size-3.5" />}
          {label}
        </span>
        <span className="tabular-nums text-gray-500">{muted ? 'Muted' : `${Math.round(value * 100)}%`}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="h-2 w-full cursor-pointer accent-brand-500"
        aria-label={`${label} volume`}
      />
    </label>
  );
};

// Author-defined template constants. Each row is a {name, value} pair that
// buildDescriptor merges into global.variables; insertable as {{ name }} in any
// overlay text.
const GlobalVariablesEditor = ({ state, patch }: MetadataFieldsProps) => {
  const { globalVariables } = state;

  const update = (i: number, p: Partial<EditorState['globalVariables'][number]>) => {
    patch({ globalVariables: globalVariables.map((v, idx) => (idx === i ? { ...v, ...p } : v)) });
  };

  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400">Global variables</span>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        Reusable values you can insert as {'{{ name }}'} in any text.
      </p>
      <div className="space-y-2">
        {globalVariables.map((variable, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <input
              aria-label={`Variable ${i + 1} name`}
              className={inputCls}
              value={variable.name}
              onChange={(e) => {
                update(i, { name: e.target.value });
              }}
              placeholder="name"
            />
            <input
              aria-label={`Variable ${i + 1} value`}
              className={inputCls}
              value={variable.value}
              onChange={(e) => {
                update(i, { value: e.target.value });
              }}
              placeholder="value"
            />
            <button
              type="button"
              onClick={() => {
                patch({ globalVariables: globalVariables.filter((_, idx) => idx !== i) });
              }}
              aria-label={`Remove variable ${i + 1}`}
              className="tap rounded-lg p-1.5 text-gray-500 transition-colors hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            patch({ globalVariables: [...globalVariables, { name: '', value: '' }] });
          }}
          className="tap inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] dark:text-gray-300"
        >
          <Plus className="h-3.5 w-3.5" /> Add variable
        </button>
      </div>
    </div>
  );
};

interface SectionListProps {
  sections: EditorSection[];
  orientation: EditorState['orientation'];
  variables: string[];
  dragIndex: number | null;
  setDragIndex: (i: number | null) => void;
  reorder: (from: number, to: number) => void;
  removeSection: (i: number) => void;
  patchSection: (i: number, p: Partial<EditorSection>) => void;
}

// Move a collapsed index `from` → `to` within the set, shifting the indices in
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

const SectionList = ({
  sections,
  orientation,
  variables,
  dragIndex,
  setDragIndex,
  reorder,
  removeSection,
  patchSection,
}: SectionListProps) => {
  // `insertAt` is the gap index (0..n) where the dragged card will land.
  const [insertAt, setInsertAt] = useState<number | null>(null);
  // Only arm `draggable` once the grip handle is pressed, so clicks/inputs inside
  // the card body (e.g. the MediaPicker) stay fully interactive.
  const [armedIndex, setArmedIndex] = useState<number | null>(null);
  // Collapsed cards, keyed by index. UI-only — never persisted to the descriptor.
  // Remapped on reorder so a card's collapsed state follows it.
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

  // Removing a card shifts every higher index down by one — keep collapsed state aligned.
  const handleRemove = (i: number) => {
    setCollapsed((prev) => {
      const next = new Set<number>();

      for (const idx of prev) {
        if (idx === i) {
          continue;
        }
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

  // Animated drop zone that grows open at gap `at` while dragging.
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
            className="tap inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-foreground/5 hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] transition-colors"
          >
            {allCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
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
            armed={armedIndex === i}
            dragging={dragIndex === i}
            collapsed={collapsed.has(i)}
            insertAt={insertAt}
            setArmedIndex={setArmedIndex}
            setDragIndex={setDragIndex}
            setInsertAt={setInsertAt}
            onItemDragOver={onItemDragOver}
            commit={commit}
            toggleCollapsed={toggleCollapsed}
            removeSection={handleRemove}
            patchSection={patchSection}
          />
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
  armed: boolean;
  dragging: boolean;
  collapsed: boolean;
  insertAt: number | null;
  setArmedIndex: (i: number | null) => void;
  setDragIndex: (i: number | null) => void;
  setInsertAt: (i: number | null) => void;
  onItemDragOver: (i: number, e: DragEvent<HTMLDivElement>) => void;
  commit: (at: number) => void;
  toggleCollapsed: (i: number) => void;
  removeSection: (i: number) => void;
  patchSection: (i: number, p: Partial<EditorSection>) => void;
}

const SectionCard = ({
  section,
  orientation,
  variables,
  index,
  armed,
  dragging,
  collapsed,
  insertAt,
  setArmedIndex,
  setDragIndex,
  setInsertAt,
  onItemDragOver,
  commit,
  toggleCollapsed,
  removeSection,
  patchSection,
}: SectionCardProps) => (
  <div
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
      'relative my-2 rounded-xl border bg-surface-2/60 p-3 transition-all duration-200 ease-[var(--ease-out-expo)]',
      dragging
        ? 'scale-[0.98] rotate-[0.5deg] cursor-grabbing border-dashed border-brand-500/50 opacity-50 shadow-lg shadow-brand-500/20'
        : 'border-foreground/10'
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
      <SectionIcon kind={section.kind} />
      <span className="font-semibold text-foreground text-sm">{SECTION_LABELS[section.kind]}</span>
      <button
        type="button"
        onClick={() => {
          removeSection(index);
        }}
        aria-label="Remove section"
        className="tap ml-auto p-1.5 rounded-lg text-gray-500 hover:text-[var(--color-error)] hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
    {!collapsed && (
      <SectionFields
        section={section}
        orientation={orientation}
        variables={variables}
        onChange={(p) => {
          patchSection(index, p);
        }}
        inputCls={inputCls}
      />
    )}
  </div>
);

const AddSectionButtons = ({ addSection }: { addSection: (kind: EditorSection['kind']) => void }) => (
  <div className="flex flex-wrap gap-2 mb-6">
    {(['video', 'form', 'color', 'music', 'image'] as const).map((kind) => (
      <button
        key={kind}
        type="button"
        onClick={() => {
          addSection(kind);
        }}
        className="tap inline-flex min-h-10 items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-foreground/10 bg-foreground/5 text-gray-700 hover:bg-foreground/10 hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition-all dark:text-gray-200"
      >
        <Plus className="w-4 h-4" /> {SECTION_LABELS[kind]}
      </button>
    ))}
  </div>
);

const SectionIcon = ({ kind }: { kind: EditorSection['kind'] }) => {
  if (kind === 'form') return <FileText className="w-4 h-4 text-brand-700 dark:text-brand-300" />;

  if (kind === 'color') return <Square className="w-4 h-4 text-secondary-700 dark:text-secondary-300" />;

  if (kind === 'music') return <Music className="w-4 h-4 text-brand-700 dark:text-brand-300" />;

  if (kind === 'image') return <ImageIcon className="w-4 h-4 text-secondary-700 dark:text-secondary-300" />;

  return <VideoIcon className="w-4 h-4 text-brand-700 dark:text-brand-300" />;
};

function SectionFields({
  section,
  orientation,
  variables,
  onChange,
  inputCls,
}: {
  section: EditorSection;
  orientation: EditorState['orientation'];
  variables: string[];
  onChange: (p: Partial<EditorSection>) => void;
  inputCls: string;
}) {
  const colorId = useId();

  if (section.kind === 'video') {
    return (
      <VideoFields
        section={section}
        orientation={orientation}
        variables={variables}
        onChange={onChange}
        inputCls={inputCls}
      />
    );
  }

  if (section.kind === 'color') {
    return (
      <div className="grid sm:grid-cols-2 gap-3 pl-7">
        <NumberField
          label="Duration (s)"
          value={section.duration}
          onChange={(v) => {
            onChange({ duration: v });
          }}
          inputCls={inputCls}
        />
        <div>
          <label htmlFor={colorId} className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Color
          </label>
          <ColorPicker
            id={colorId}
            aria-label="Background color"
            value={section.color}
            onChange={(c) => {
              onChange({ color: c });
            }}
          />
        </div>
      </div>
    );
  }

  if (section.kind === 'music') {
    return <MusicFields section={section} onChange={onChange} />;
  }

  if (section.kind === 'image') {
    return <ImageFields section={section} onChange={onChange} inputCls={inputCls} />;
  }

  // form
  return (
    <div className="space-y-2 pl-7">
      {section.fields.map((field, fi) => (
        <div key={fi} className="grid grid-cols-[1fr_1fr_5rem_auto] gap-2 items-center">
          <input
            aria-label="Field ID"
            className={inputCls}
            value={field.name}
            onChange={(e) => {
              onChange({ fields: section.fields.map((f, idx) => (idx === fi ? { ...f, name: e.target.value } : f)) });
            }}
            placeholder="field id"
          />
          <input
            aria-label="Field label"
            className={inputCls}
            value={field.label}
            onChange={(e) => {
              onChange({ fields: section.fields.map((f, idx) => (idx === fi ? { ...f, label: e.target.value } : f)) });
            }}
            placeholder="Label"
          />
          <input
            aria-label="Max length"
            type="number"
            className={inputCls}
            value={field.maxLength}
            onChange={(e) => {
              onChange({
                fields: section.fields.map((f, idx) => (idx === fi ? { ...f, maxLength: Number(e.target.value) } : f)),
              });
            }}
          />
          <button
            type="button"
            onClick={() => {
              onChange({ fields: section.fields.filter((_, idx) => idx !== fi) });
            }}
            aria-label="Remove field"
            className="tap rounded-lg p-1.5 text-gray-500 hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          onChange({
            fields: [...section.fields, { name: `field_${section.fields.length + 1}`, label: 'Label', maxLength: 40 }],
          });
        }}
        className="tap inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-foreground/5 text-gray-600 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] transition-colors dark:text-gray-300"
      >
        <Plus className="w-3.5 h-3.5" /> Add field
      </button>
    </div>
  );
}

type VideoSection = Extract<EditorSection, { kind: 'video' }>;
type MusicSection = Extract<EditorSection, { kind: 'music' }>;
type ImageSection = Extract<EditorSection, { kind: 'image' }>;

const VideoFields = ({
  section,
  orientation,
  variables,
  onChange,
  inputCls,
}: {
  section: VideoSection;
  orientation: EditorState['orientation'];
  variables: string[];
  onChange: (p: Partial<EditorSection>) => void;
  inputCls: string;
}) => (
  <div className="space-y-3 pl-7">
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberField
        label="Duration (s)"
        value={section.duration}
        onChange={(v) => {
          onChange({ duration: v });
        }}
        inputCls={inputCls}
      />
      <label className="mt-6 flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <Checkbox
          checked={section.mute}
          onCheckedChange={(c) => {
            onChange({ mute: c === true });
          }}
        />{' '}
        Mute audio
      </label>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <Checkbox
          checked={section.countdown}
          onCheckedChange={(c) => {
            onChange({ countdown: c === true });
          }}
        />{' '}
        Countdown before recording
      </label>
      {section.countdown && (
        <NumberField
          label="Countdown (s)"
          value={section.countdownSeconds}
          onChange={(v) => {
            onChange({ countdownSeconds: v });
          }}
          inputCls={inputCls}
        />
      )}
    </div>
    <OverlayCanvas
      overlays={section.overlays}
      orientation={orientation}
      variables={variables}
      onChange={(overlays) => {
        onChange({ overlays });
      }}
    />
  </div>
);

const MusicFields = ({
  section,
  onChange,
}: {
  section: MusicSection;
  onChange: (p: Partial<EditorSection>) => void;
}) => (
  <div className="space-y-3 pl-7">
    <p className="text-xs text-gray-500 dark:text-gray-400">Pick the tracks viewers can choose from.</p>
    <MediaPicker
      kind="music"
      multiple
      selectedIds={section.allowed}
      onToggleId={(id) => {
        onChange({ allowed: toggleId(section.allowed, id) });
      }}
    />
    <label className="flex w-fit items-center gap-2 text-sm text-gray-700 cursor-pointer select-none dark:text-gray-200">
      <Checkbox
        checked={section.allowUpload}
        onCheckedChange={(c) => {
          onChange({ allowUpload: c === true });
        }}
      />
      Allow viewers to upload their own track
    </label>
  </div>
);

const ImageFields = ({
  section,
  onChange,
  inputCls,
}: {
  section: ImageSection;
  onChange: (p: Partial<EditorSection>) => void;
  inputCls: string;
}) => (
  <div className="space-y-3 pl-7">
    <div className="sm:w-40">
      <NumberField
        label="Duration (s)"
        value={section.duration}
        onChange={(v) => {
          onChange({ duration: v });
        }}
        inputCls={inputCls}
      />
    </div>
    <p className="text-xs text-gray-500 dark:text-gray-400">Pick the images viewers can choose from.</p>
    <MediaPicker
      kind="picture"
      multiple
      selectedIds={section.allowed}
      onToggleId={(id) => {
        onChange({ allowed: toggleId(section.allowed, id) });
      }}
    />
    <label className="flex w-fit items-center gap-2 text-sm text-gray-700 cursor-pointer select-none dark:text-gray-200">
      <Checkbox
        checked={section.allowUpload}
        onCheckedChange={(c) => {
          onChange({ allowUpload: c === true });
        }}
      />
      Allow viewers to upload their own image
    </label>
  </div>
);

const NumberField = ({
  label,
  value,
  onChange,
  inputCls,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  inputCls: string;
}) => {
  const numberId = useId();

  return (
    <div>
      <label htmlFor={numberId} className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
        {label}
      </label>
      <input
        id={numberId}
        type="number"
        min={1}
        className={inputCls}
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
      />
    </div>
  );
};
