import { useState, useId, useRef, useEffect, Fragment, type DragEvent, type ReactNode } from 'react';
import {
  GripVertical,
  Trash2,
  Copy,
  Plus,
  ArrowLeft,
  Video as VideoIcon,
  Square,
  FileText,
  Music,
  Image as ImageIcon,
  Braces,
  Save,
  ArrowDown,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Undo2,
  Redo2,
  Download,
  Upload,
  Settings2,
} from 'lucide-react';
import clsx from 'clsx';
import { templateService, type Template } from '@/services/templateService';
import { userTemplateService } from '@/services/userTemplateService';
import { userPartialService } from '@/services/userPartialService';
import { listAvailablePartials, type AvailablePartial } from '@/services/templatePartialService';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import type { StoredPartial } from '@/stores/userPartialStore';
import {
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/presentation/components/ui';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import {
  buildDescriptor,
  collectVariables,
  patch as patchOp,
  patchSection as patchSectionOp,
  addSection as addSectionOp,
  removeSection as removeSectionOp,
  reorderSection as reorderSectionOp,
  duplicateSection as duplicateSectionOp,
  patchLayers,
  setTransitionAfter,
  toEditorState,
  SECTION_LABELS,
  type BackgroundLayer,
  type EditorSection,
  type EditorState,
  type SectionTransition,
} from './templateEditorModel';
import { AudioPanel } from './editor/AudioPanel';
import { TransitionPicker } from './editor/TransitionPicker';
import { SectionFields } from './editor/SectionFields';
import { TimelineStrip } from './editor/TimelineStrip';
import { TestRenderButton } from './editor/TestRenderButton';
import { SectionDisclosure } from './editor/SectionDisclosure';
import { FadeIn } from './editor/FadeIn';
import { SegmentedControl } from './editor/controls';
import { BuilderModeProvider, useBuilderMode } from './editor/useBuilderMode';
import { SECTION_HINTS } from './editor/sectionHints';
import {
  runValidation,
  groupValidationErrors,
  errorsForEditorSection,
  type SectionValidation,
  type ValidationError,
} from './editor/validationMapping';
import { exportDescriptorJson, exportFilename, importDescriptorJson } from './editor/templateIO';

export { buildDescriptor } from './templateEditorModel';

// DOM id for a section card, so the timeline strip can scroll it into view.
const sectionDomId = (index: number): string => `template-section-${index}`;

// Save-time guards (name, at least one section, media-or-upload, no hard validation errors).
// Returns the first human message to show, or null when the template is safe to save.
function saveGuardError(state: EditorState, hasHardErrors: boolean): string | null {
  if (state.name.trim() === '') return 'Give your template a name.';

  if (state.sections.length === 0) return 'Add at least one section.';

  const emptyMedia = state.sections.find(
    (s) => (s.kind === 'music' || s.kind === 'image') && s.allowed.length === 0 && !s.allowUpload
  );

  if (emptyMedia) {
    const label = emptyMedia.kind === 'music' ? 'Background music' : 'Background image';

    return `Pick at least one option for the ${label} section, or allow uploads.`;
  }

  if (hasHardErrors) return 'Fix the highlighted section errors before saving.';

  return null;
}

// Editor state -> the persisted user Template (descriptor + derived metadata).
function toUserTemplate(state: EditorState): Template {
  const descriptor = buildDescriptor(state);

  return {
    id: state.id,
    name: state.name.trim(),
    description: state.description.trim(),
    orientation: state.orientation,
    hasForm: templateService.extractFormFields(descriptor).length > 0,
    complexity: templateService.getTemplateComplexity(descriptor),
    source: 'user',
    descriptor,
  };
}

// A visual section emits a transition into the next one; music/form do not. The chip
// is only rendered after a visual section that has a visual section still ahead of it.
const VISUAL_KINDS: ReadonlySet<EditorSection['kind']> = new Set(['video', 'color', 'image']);

const isVisual = (section: EditorSection): boolean => VISUAL_KINDS.has(section.kind);

interface TemplateEditorProps {
  initial: Template | null;
  onSaved: () => void;
  onCancel: () => void;
}

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-surface-2 border border-foreground/10 text-foreground placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all';

export const TemplateEditor = ({ initial, onSaved, onCancel }: TemplateEditorProps) => {
  const history = useEditorHistory(toEditorState(initial));
  const { state, set, undo, redo, canUndo, canRedo, reset } = history;
  const [localPartials, setLocalPartials] = useState<StoredPartial[]>(() => userPartialService.list());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [mode, setMode] = useBuilderMode();
  const advanced = mode === 'advanced';
  const variables = collectVariables(state);
  const partials = listAvailablePartials(localPartials);
  const refreshPartials = (): void => {
    setLocalPartials(userPartialService.list());
  };

  // Inline validation, recomputed on a 300ms debounce so typing stays smooth.
  const validation = useDebouncedValidation(state, localPartials);
  // Hard errors gate Save + Preview (mirrors the original save-time guards).
  const hasHardErrors = validation.hasErrors;
  // The first unmet save guard, surfaced inline so a disabled Save explains itself.
  const saveBlockedReason = saveGuardError(state, hasHardErrors);

  // Every mutation routes through history.set(op(state,...)) so each is a single undoable step.
  const ops = useSectionOps(set);
  const { patch, patchSection, addSection, removeSection, duplicateSection, reorder, setTransition, setLayers } = ops;

  // Scroll a section card into view + focus it (timeline-strip click target).
  const scrollToSection = (index: number) => {
    const el = document.getElementById(sectionDomId(index));

    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  };

  // ⌘Z / ⇧⌘Z (Ctrl on non-mac) within the editor, ignoring keystrokes inside text inputs.
  useEditorShortcuts({ undo, redo });

  const exportJson = () => {
    downloadText(exportDescriptorJson(state), exportFilename(state));
  };

  const importJson = (text: string) => {
    const result = importDescriptorJson(text, state);

    if (!result.ok) {
      setImportErrors(result.errors);

      return;
    }
    reset(result.state);
  };

  const handleSave = () => {
    const guard = saveGuardError(state, hasHardErrors);

    if (guard !== null) {
      setError(guard);

      return;
    }

    setError('');

    try {
      userTemplateService.save(toUserTemplate(state));
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save the template.');
    }
  };

  return (
    <BuilderModeProvider mode={mode}>
      <div className="min-h-[calc(100vh-4rem)] bg-background">
        <div className="mx-auto w-full max-w-2xl px-4 pt-24 pb-28">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="group mb-4 -ml-2 rounded-full px-3 text-gray-500 hover:text-foreground dark:text-gray-400"
          >
            <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1" /> Templates
          </Button>

          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-3xl font-bold font-display text-foreground mb-1">
                {initial ? 'Edit template' : 'Create a template'}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Build your scenes top to bottom, then save — it appears in the builder as a Custom template.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SegmentedControl
                value={mode}
                onChange={setMode}
                className="shrink-0"
                options={[
                  { value: 'simple', label: 'Simple' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
              />
              <PartialsDialog partials={partials} onChanged={refreshPartials} />
              <EditorToolbar
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onExport={exportJson}
                onImport={importJson}
              />
            </div>
          </div>

          <BasicsFields state={state} patch={patch} />

          <TimelineStrip state={state} onScrollToSection={scrollToSection} onReorder={reorder} />

          {validation.global.length > 0 && <GlobalValidationBanner errors={validation.global} />}

          {/* Sections — a top-to-bottom timeline the author composes and reorders. */}
          <div className="mb-2">
            <span className="block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Scenes
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Each scene plays in order, top to bottom — drag the handle to rearrange.
            </p>
          </div>
          <SectionList
            sections={state.sections}
            orientation={state.orientation}
            variables={variables}
            dragIndex={dragIndex}
            validation={validation}
            editorState={state}
            partials={partials}
            setDragIndex={setDragIndex}
            reorder={reorder}
            removeSection={removeSection}
            duplicateSection={duplicateSection}
            patchSection={patchSection}
            setTransition={setTransition}
            setLayers={setLayers}
          />

          <AddSectionButtons addSection={addSection} />

          {advanced && (
            <FadeIn className="mb-6">
              <AdvancedSettings state={state} patch={patch} />
            </FadeIn>
          )}

          {error && (
            <p
              role="alert"
              className="fade-in mb-4 flex items-start gap-2 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3.5 py-2.5 text-sm font-medium text-[var(--color-error)]"
            >
              <AlertCircle className="mt-px size-4 shrink-0" /> {error}
            </p>
          )}

          {/* Sticky action bar so Save stays reachable on long templates. */}
          <div className="sticky bottom-0 -mx-4 mt-6 border-t border-foreground/10 bg-background/85 px-4 py-4 backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]">
            {saveBlockedReason && <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{saveBlockedReason}</p>}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saveBlockedReason !== null}
                className="min-h-11 flex-1 active:scale-[0.98]"
              >
                <Save className="w-5 h-5" /> Save template
              </Button>
              <TestRenderButton state={state} disabled={hasHardErrors} />
              <Button variant="secondary" onClick={onCancel} className="min-h-11 px-6 active:scale-[0.98]">
                Cancel
              </Button>
            </div>
          </div>
        </div>

        <ImportErrorDialog
          errors={importErrors}
          onClose={() => {
            setImportErrors(null);
          }}
        />
      </div>
    </BuilderModeProvider>
  );
};

type SetState = (next: EditorState | ((current: EditorState) => EditorState)) => void;

// The section/state mutation handlers, each wrapping a shared pure op in history.set so it becomes
// a single undoable step. Extracted from the component so the body stays under the statement budget.
function useSectionOps(set: SetState) {
  return {
    patch: (p: Partial<EditorState>) => {
      set((s) => patchOp(s, p));
    },
    patchSection: (i: number, p: Partial<EditorSection>) => {
      set((s) => patchSectionOp(s, i, p));
    },
    addSection: (kind: EditorSection['kind']) => {
      set((s) => addSectionOp(s, kind));
    },
    removeSection: (i: number) => {
      set((s) => removeSectionOp(s, i));
    },
    duplicateSection: (i: number) => {
      set((s) => duplicateSectionOp(s, i));
    },
    reorder: (from: number, to: number) => {
      if (from === to) return;
      set((s) => reorderSectionOp(s, from, to));
    },
    setTransition: (i: number, transition: SectionTransition | undefined) => {
      set((s) => setTransitionAfter(s, i, transition));
    },
    setLayers: (i: number, layers: BackgroundLayer[]) => {
      set((s) => patchLayers(s, i, layers));
    },
  };
}

// Debounced (300ms) inline validation: build the descriptor, run the core validator, and group the
// errors by section. Returns immediately-empty on the first render, then updates after the debounce.
function useDebouncedValidation(state: EditorState, localPartials: StoredPartial[]): SectionValidation {
  const [validation, setValidation] = useState<SectionValidation>(() => groupValidationErrors([]));

  useEffect(() => {
    const handle = setTimeout(() => {
      setValidation(groupValidationErrors(runValidation(buildDescriptor(state), localPartials)));
    }, 300);

    return () => {
      clearTimeout(handle);
    };
  }, [state, localPartials]);

  return validation;
}

// ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Shift+Z off mac) for undo/redo — but never while the user is typing in a
// text field, so it doesn't fight the browser's native input undo.
function useEditorShortcuts({ undo, redo }: { undo: () => void; redo: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey;

      if (!mod || e.key.toLowerCase() !== 'z') return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;

      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      e.preventDefault();

      if (e.shiftKey) {
        redo();

        return;
      }
      undo();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [undo, redo]);
}

// Trigger a client-side download of `text` as a JSON file named `filename`.
function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onImport: (text: string) => void;
}

const EditorToolbar = ({ canUndo, canRedo, onUndo, onRedo, onExport, onImport }: EditorToolbarProps) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;

    onImport(await file.text());

    // Reset so re-selecting the same file fires change again.
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex items-center gap-1">
      <IconBtn label="Undo" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="h-4 w-4" />
      </IconBtn>
      <IconBtn label="Redo" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="h-4 w-4" />
      </IconBtn>
      <span aria-hidden className="mx-1 h-5 w-px bg-foreground/10" />
      <IconBtn label="Export template JSON" onClick={onExport}>
        <Download className="h-4 w-4" />
      </IconBtn>
      <IconBtn
        label="Import template JSON"
        onClick={() => {
          fileRef.current?.click();
        }}
      >
        <Upload className="h-4 w-4" />
      </IconBtn>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0]).catch(() => {});
        }}
      />
    </div>
  );
};

const IconBtn = ({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className="tap grid h-9 w-9 place-items-center rounded-lg border border-foreground/10 bg-foreground/5 text-gray-600 transition-colors hover:bg-foreground/10 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-40 dark:text-gray-300"
  >
    {children}
  </button>
);

const PartialsDialog = ({ partials, onChanged }: { partials: AvailablePartial[]; onChanged: () => void }) => {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const selected = partials.find((partial) => partial.id === selectedId) ?? null;
  const readonly = selected?.readonly === true;

  const loadPartial = (partial: AvailablePartial): void => {
    setSelectedId(partial.id);
    setDraft(formatPartialJson(partial));
    setError('');
  };

  const loadNew = (): void => {
    setSelectedId('');
    setDraft(formatPartialJson(defaultPartialDraft()));
    setError('');
  };

  const openManager = (): void => {
    setOpen(true);

    const current = partials.find((partial) => partial.id === selectedId) ?? partials[0];

    if (current) {
      loadPartial(current);

      return;
    }
    loadNew();
  };

  const saveDraft = (): void => {
    try {
      const saved = userPartialService.save(parsePartialJson(draft));
      onChanged();
      setSelectedId(saved.id);
      setDraft(formatPartialJson(saved));
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save partial.');
    }
  };

  const deleteSelected = (): void => {
    if (selected?.source !== 'local') return;

    userPartialService.remove(selected.id);
    onChanged();

    const fallback = partials.find((partial) => partial.id !== selected.id);

    if (fallback) {
      loadPartial(fallback);

      return;
    }
    loadNew();
  };

  return (
    <>
      <IconBtn label="Manage partials" onClick={openManager}>
        <Braces className="h-4 w-4" />
      </IconBtn>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Partials</DialogTitle>
            <DialogDescription>Reusable descriptor fragments for partial scene sections.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-[13rem_1fr]">
            <div className="space-y-2">
              <button
                type="button"
                onClick={loadNew}
                className="tap flex w-full items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <Plus className="h-4 w-4" /> New local partial
              </button>
              <div className="max-h-[48vh] space-y-1 overflow-y-auto pr-1">
                {partials.map((partial) => (
                  <button
                    key={partial.id}
                    type="button"
                    onClick={() => {
                      loadPartial(partial);
                    }}
                    className={clsx(
                      'tap w-full rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                      partial.id === selectedId
                        ? 'bg-brand-500/15 text-brand-700 dark:text-brand-200'
                        : 'bg-foreground/5 text-gray-600 hover:bg-foreground/10 dark:text-gray-300'
                    )}
                  >
                    <span className="block truncate text-sm font-semibold">{partial.id}</span>
                    <span className="block text-xs opacity-75">
                      {partial.source === 'local' ? 'Local' : 'Built-in'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <textarea
                aria-label="Partial JSON"
                className="min-h-[20rem] w-full resize-y rounded-lg border border-foreground/10 bg-surface-2 px-3 py-2 font-mono text-xs text-foreground placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-70"
                value={draft}
                readOnly={readonly}
                onChange={(e) => {
                  setDraft(e.target.value);
                }}
                spellCheck={false}
              />

              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-xs font-medium text-[var(--color-error)]"
                >
                  <AlertCircle className="mt-px size-3.5 shrink-0" /> {error}
                </p>
              )}

              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="secondary" type="button" onClick={loadNew}>
                  <Plus className="h-4 w-4" /> New
                </Button>
                <div className="flex gap-2">
                  {selected?.source === 'local' && (
                    <Button variant="danger" type="button" onClick={deleteSelected}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  )}
                  <Button variant="primary" type="button" onClick={saveDraft} disabled={readonly}>
                    <Save className="h-4 w-4" /> Save partial
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

function defaultPartialDraft(): TemplatePartial {
  return {
    id: 'local:new-partial',
    description: 'Local partial',
    sections: [{ name: 'intro', type: 'color_background', options: { duration: 1, backgroundColor: '#111111' } }],
  };
}

function formatPartialJson(partial: TemplatePartial): string {
  return JSON.stringify(
    {
      id: partial.id,
      description: partial.description,
      sections: partial.sections,
    },
    null,
    2
  );
}

function parsePartialJson(text: string): TemplatePartial {
  const parsed: unknown = JSON.parse(text);

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Partial JSON must be an object.');
  }

  const partial = parsed as { id?: unknown; description?: unknown; sections?: unknown };

  if (typeof partial.id !== 'string') {
    throw new Error('Partial JSON must include a string id.');
  }

  if (typeof partial.description !== 'string') {
    throw new Error('Partial JSON must include a string description.');
  }

  if (!Array.isArray(partial.sections)) {
    throw new Error('Partial JSON must include a sections array.');
  }

  return {
    id: partial.id,
    description: partial.description,
    sections: partial.sections as TemplatePartial['sections'],
  };
}

const GlobalValidationBanner = ({ errors }: { errors: ValidationError[] }) => (
  <div
    role="alert"
    className="fade-in mb-4 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3.5 py-2.5 text-sm font-medium text-[var(--color-error)]"
  >
    <p className="flex items-center gap-2">
      <AlertCircle className="size-4 shrink-0" /> This template has problems:
    </p>
    <ul className="mt-1 list-disc space-y-0.5 pl-7">
      {errors.map((e, i) => (
        <li key={i}>{e.message}</li>
      ))}
    </ul>
  </div>
);

const ImportErrorDialog = ({ errors, onClose }: { errors: string[] | null; onClose: () => void }) => (
  <Dialog
    open={errors !== null}
    onOpenChange={(next) => {
      if (!next) onClose();
    }}
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Could not import</DialogTitle>
        <DialogDescription>The file is not a valid template descriptor.</DialogDescription>
      </DialogHeader>
      <ul className="max-h-[50vh] space-y-1 overflow-y-auto rounded-lg bg-foreground/5 p-3 text-sm text-[var(--color-error)]">
        {(errors ?? []).map((e, i) => (
          <li key={i} className="font-mono text-xs">
            {e}
          </li>
        ))}
      </ul>
    </DialogContent>
  </Dialog>
);

interface MetadataFieldsProps {
  state: EditorState;
  patch: (p: Partial<EditorState>) => void;
}

// Always-visible basics: name + orientation. Compact, sits right under the header.
const BasicsFields = ({ state, patch }: MetadataFieldsProps) => {
  const nameId = useId();

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_12rem]">
      <div>
        <label
          htmlFor={nameId}
          className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
        >
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
        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
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
  );
};

// Power-user finishing concerns (global audio mix + template variables), tucked into one collapsed
// disclosure below the scenes so they never sit between the basics and the creative work.
const AdvancedSettings = ({ state, patch }: MetadataFieldsProps) => (
  <SectionDisclosure
    label="Advanced settings"
    icon={<Settings2 className="size-4 shrink-0 text-brand-500" aria-hidden />}
    summary="Audio mix · Variables"
  >
    <AudioPanel
      audio={state.audio}
      onChange={(audio) => {
        patch({ audio });
      }}
    />
    <GlobalVariablesEditor state={state} patch={patch} />
  </SectionDisclosure>
);

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
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        Global variables
      </span>
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
}

// True when section `i` is visual AND some later section is also visual — i.e. a
// transition chip belongs after it (the last visual section never gets one; the
// validator rejects a dangling transition).
const hasVisualAfter = (sections: EditorSection[], i: number): boolean =>
  isVisual(sections[i]) && sections.slice(i + 1).some(isVisual);

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
          {/* Boundary transition chip — hidden mid-drag so it never fights the drop animation. */}
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
    id={sectionDomId(index)}
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
          className="tap p-1.5 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-90 transition-colors dark:hover:text-brand-300"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            removeSection(index);
          }}
          aria-label="Remove section"
          className="tap p-1.5 rounded-lg text-gray-500 hover:text-[var(--color-error)] hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90 transition-colors"
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
        inputCls={inputCls}
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

const AddSectionButtons = ({ addSection }: { addSection: (kind: EditorSection['kind']) => void }) => (
  <div className="mb-6">
    <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
      Add a scene
    </span>
    <div className="grid gap-2 sm:grid-cols-2">
      {(['video', 'form', 'color', 'music', 'image', 'partial'] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => {
            addSection(kind);
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
      ))}
    </div>
  </div>
);

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

// One-line at-a-glance summary shown on a collapsed card, so authors can scan the
// whole template without expanding every section.
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
