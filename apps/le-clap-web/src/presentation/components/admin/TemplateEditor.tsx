import { useState, useId, Fragment, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  GripVertical,
  Trash2,
  Plus,
  X,
  Type,
  Video as VideoIcon,
  Square,
  FileText,
  Save,
  ArrowDown,
  AlertCircle,
  Music,
  Image as ImageIcon,
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
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import {
  buildDescriptor,
  newSection,
  SECTION_LABELS,
  toEditorState,
  type EditorSection,
  type EditorState,
} from './templateEditorModel';
import { MediaPicker } from './MediaPicker';

export { buildDescriptor } from './templateEditorModel';

interface TemplateEditorProps {
  initial: Template | null;
  onSaved: () => void;
  onCancel: () => void;
}

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-surface-2 border border-foreground/10 text-foreground placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all';

export const TemplateEditor = ({ initial, onSaved, onCancel }: TemplateEditorProps) => {
  const [state, setState] = useState<EditorState>(() => toEditorState(initial));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState('');

  useLockBodyScroll();

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

  const toggleMusicId = (id: string) => {
    setState((s) => {
      const next = s.allowedMusic.includes(id) ? s.allowedMusic.filter((m) => m !== id) : [...s.allowedMusic, id];

      return { ...s, allowedMusic: next };
    });
  };

  const toggleBackgroundId = (id: string) => {
    setState((s) => {
      const next = s.allowedBackgrounds.includes(id)
        ? s.allowedBackgrounds.filter((b) => b !== id)
        : [...s.allowedBackgrounds, id];

      return { ...s, allowedBackgrounds: next };
    });
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

    if (state.musicEnabled && state.allowedMusic.length === 0) {
      setError('Pick at least one music track or turn off background music.');

      return;
    }

    if (state.backgroundEnabled && state.allowedBackgrounds.length === 0) {
      setError('Pick at least one background image or turn off background image.');

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

  return createPortal(
    <div className="fixed inset-0 z-[58] overflow-y-auto bg-black/40 backdrop-blur-md dark:bg-black/70">
      <div className="relative min-h-full flex items-start sm:items-center justify-center p-4 pt-[max(1.5rem,env(safe-area-inset-top))] safe-b">
        <div className="relative w-full max-w-2xl bg-surface border border-foreground/10 rounded-2xl p-6 sm:p-8 shadow-2xl rise-in">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Close editor"
            className="absolute top-4 right-4 rounded-full text-gray-500 active:scale-90 dark:text-gray-400 before:absolute before:-inset-1.5 before:content-['']"
          >
            <X className="w-5 h-5" />
          </Button>

          <h2 className="text-2xl font-bold font-display text-foreground mb-1 pr-10">
            {initial ? 'Edit template' : 'Create a template'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
            Compose sections, then save — it appears in the builder as a Custom template.
          </p>

          <MetadataFields
            state={state}
            patch={patch}
            toggleMusicId={toggleMusicId}
            toggleBackgroundId={toggleBackgroundId}
          />

          {/* Sections (drag to reorder) */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Sections — drag to reorder
            </span>
          </div>
          <SectionList
            sections={state.sections}
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

          <div className="flex gap-3">
            <Button variant="primary" onClick={handleSave} className="min-h-11 flex-1 active:scale-[0.98]">
              <Save className="w-5 h-5" /> Save template
            </Button>
            <Button variant="secondary" onClick={onCancel} className="min-h-11 px-6 active:scale-[0.98]">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

interface MetadataFieldsProps {
  state: EditorState;
  patch: (p: Partial<EditorState>) => void;
  toggleMusicId: (id: string) => void;
  toggleBackgroundId: (id: string) => void;
}

const MetadataFields = ({ state, patch, toggleMusicId, toggleBackgroundId }: MetadataFieldsProps) => {
  const nameId = useId();

  return (
    <div className="grid sm:grid-cols-2 gap-3 mb-6">
      <div className="sm:col-span-2">
        <label htmlFor={nameId} className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
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
        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Orientation</label>
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

      {/* Background music panel */}
      <div className="sm:col-span-2">
        <label className="flex w-fit items-center gap-2 text-sm text-gray-700 cursor-pointer select-none dark:text-gray-200">
          <Checkbox
            checked={state.musicEnabled}
            onCheckedChange={(c) => {
              patch({ musicEnabled: c === true });
            }}
          />
          Background music
        </label>
        {state.musicEnabled && (
          <div className="mt-3">
            <MediaPicker kind="music" multiple selectedIds={state.allowedMusic} onToggleId={toggleMusicId} />
          </div>
        )}
      </div>

      {/* Background image panel */}
      <div className="sm:col-span-2">
        <label className="flex w-fit items-center gap-2 text-sm text-gray-700 cursor-pointer select-none dark:text-gray-200">
          <Checkbox
            checked={state.backgroundEnabled}
            onCheckedChange={(c) => {
              patch({ backgroundEnabled: c === true });
            }}
          />
          Background image
        </label>
        {state.backgroundEnabled && (
          <div className="mt-3">
            <MediaPicker
              kind="picture"
              multiple
              selectedIds={state.allowedBackgrounds}
              onToggleId={toggleBackgroundId}
            />
          </div>
        )}
      </div>
    </div>
  );
};

interface SectionListProps {
  sections: EditorSection[];
  dragIndex: number | null;
  setDragIndex: (i: number | null) => void;
  reorder: (from: number, to: number) => void;
  removeSection: (i: number) => void;
  patchSection: (i: number, p: Partial<EditorSection>) => void;
}

const SectionList = ({ sections, dragIndex, setDragIndex, reorder, removeSection, patchSection }: SectionListProps) => {
  // `insertAt` is the gap index (0..n) where the dragged card will land.
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const dragging = dragIndex !== null;

  const commit = (at: number) => {
    if (dragIndex !== null) {
      const target = dragIndex < at ? at - 1 : at;

      if (target !== dragIndex) reorder(dragIndex, target);
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
      {sections.map((section, i) => (
        <Fragment key={i}>
          {dropZone(i)}
          <div
            draggable
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              onItemDragOver(i, e);
            }}
            onDrop={() => {
              commit(insertAt ?? i);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setInsertAt(null);
            }}
            className={clsx(
              'relative my-2 rounded-xl border bg-surface-2/60 p-3 transition-all duration-200 ease-[var(--ease-out-expo)]',
              dragIndex === i
                ? 'scale-[0.98] rotate-[0.5deg] cursor-grabbing border-dashed border-brand-500/50 opacity-50 shadow-lg shadow-brand-500/20'
                : 'border-foreground/10'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                className="cursor-grab rounded-md text-gray-500 transition-all hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:cursor-grabbing active:scale-125"
                aria-label="Drag to reorder"
              >
                <GripVertical className="w-5 h-5" />
              </button>
              <SectionIcon kind={section.kind} />
              <span className="font-semibold text-foreground text-sm">{SECTION_LABELS[section.kind]}</span>
              <button
                type="button"
                onClick={() => {
                  removeSection(i);
                }}
                aria-label="Remove section"
                className="tap ml-auto p-1.5 rounded-lg text-gray-500 hover:text-[var(--color-error)] hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <SectionFields
              section={section}
              onChange={(p) => {
                patchSection(i, p);
              }}
              inputCls={inputCls}
            />
          </div>
        </Fragment>
      ))}
      {dropZone(sections.length)}
    </div>
  );
};

const AddSectionButtons = ({ addSection }: { addSection: (kind: EditorSection['kind']) => void }) => (
  <div className="flex flex-wrap gap-2 mb-6">
    {(['video', 'form', 'color', 'usermusic', 'userphoto'] as const).map((kind) => (
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

  if (kind === 'usermusic') return <Music className="w-4 h-4 text-brand-700 dark:text-brand-300" />;

  if (kind === 'userphoto') return <ImageIcon className="w-4 h-4 text-secondary-700 dark:text-secondary-300" />;

  return <VideoIcon className="w-4 h-4 text-brand-700 dark:text-brand-300" />;
};

function SectionFields({
  section,
  onChange,
  inputCls,
}: {
  section: EditorSection;
  onChange: (p: Partial<EditorSection>) => void;
  inputCls: string;
}) {
  const colorId = useId();

  if (section.kind === 'video') {
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
        <label className="flex items-center gap-2 mt-6 text-sm text-gray-700 cursor-pointer select-none dark:text-gray-200">
          <Checkbox
            checked={section.mute}
            onCheckedChange={(c) => {
              onChange({ mute: c === true });
            }}
          />{' '}
          Mute audio
        </label>
        <div className="sm:col-span-2 flex items-center gap-2">
          <Type className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            aria-label="Overlay text"
            className={inputCls}
            value={section.text}
            onChange={(e) => {
              onChange({ text: e.target.value });
            }}
            placeholder="Overlay text (optional) — supports {{firstname}}"
          />
        </div>
      </div>
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

  if (section.kind === 'usermusic') {
    return <p className="pl-7 text-sm text-gray-500 dark:text-gray-400">Viewers upload their own music track.</p>;
  }

  if (section.kind === 'userphoto') {
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
        <p className="sm:col-span-2 text-sm text-gray-500 dark:text-gray-400">Viewers upload their own photo.</p>
      </div>
    );
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
