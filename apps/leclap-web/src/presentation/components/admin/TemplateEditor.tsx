import { useState, useId, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2,
  Plus,
  ArrowLeft,
  Braces,
  Save,
  AlertCircle,
  Undo2,
  Redo2,
  Download,
  Upload,
  Settings2,
} from 'lucide-react';
import { templateService, type Template } from '@/services/templateService';
import { userTemplateService } from '@/services/userTemplateService';
import { userPartialService } from '@/services/userPartialService';
import { listAvailablePartials } from '@/services/templatePartialService';
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
  toEditorState,
  type EditorSection,
  type EditorState,
} from './templateEditorModel';
import { AudioPanel } from './editor/AudioPanel';
import { TimelineStrip } from './editor/TimelineStrip';
import { TestRenderButton } from './editor/TestRenderButton';
import { SectionDisclosure } from './editor/SectionDisclosure';
import { FadeIn } from './editor/FadeIn';
import { SegmentedControl } from './editor/controls';
import { BuilderModeProvider, useBuilderMode } from './editor/useBuilderMode';
import {
  runValidation,
  groupValidationErrors,
  type SectionValidation,
  type ValidationError,
} from './editor/validationMapping';
import { exportDescriptorJson, exportFilename, importDescriptorJson } from './editor/templateIO';
import { SceneList, AddSectionButtons } from './editor/SceneList';
import { EDITOR_INPUT_CLASS } from './editor/editorStyles';
import { useEditorSectionOps } from './editor/useEditorSectionOps';
import { partialFromDraftState } from './editor/partialDraft';

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

interface TemplateEditorProps {
  initial: Template | null;
  onSaved: () => void;
  onCancel: () => void;
}

export const TemplateEditor = ({ initial, onSaved, onCancel }: TemplateEditorProps) => {
  const navigate = useNavigate();
  const history = useEditorHistory(toEditorState(initial));
  const { state, set, undo, redo, canUndo, canRedo, reset } = history;
  const [localPartials] = useState<StoredPartial[]>(() => userPartialService.list());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [copyPartialDialogOpen, setCopyPartialDialogOpen] = useState(false);
  const [mode, setMode] = useBuilderMode();
  const advanced = mode === 'advanced';
  const variables = collectVariables(state);
  const partials = listAvailablePartials(localPartials);

  // Inline validation, recomputed on a 300ms debounce so typing stays smooth.
  const validation = useDebouncedValidation(state, localPartials);
  // Hard errors gate Save + Preview (mirrors the original save-time guards).
  const hasHardErrors = validation.hasErrors;
  // The first unmet save guard, surfaced inline so a disabled Save explains itself.
  const saveBlockedReason = saveGuardError(state, hasHardErrors);

  // Every mutation routes through history.set(op(state,...)) so each is a single undoable step.
  const ops = useEditorSectionOps(set);
  const { patch, patchSection, addSection, removeSection, duplicateSection, reorder, setTransition, setLayers } = ops;
  const addEditorSection = (kind: EditorSection['kind']): void => {
    addSection(kind, kind === 'partial' ? { ref: partials[0]?.id ?? '' } : undefined);
  };

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

  const openPartials = (partialDraft?: TemplatePartial): void => {
    const options = partialDraft ? { state: { partialDraft } } : undefined;
    Promise.resolve(navigate('/partials', options)).catch(() => {});
  };

  const copyTemplateToPartial = (): void => {
    setCopyPartialDialogOpen(false);
    openPartials(partialDraftFromTemplateState(state));
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
              <IconBtn
                label="Manage partials"
                onClick={() => {
                  setCopyPartialDialogOpen(true);
                }}
              >
                <Braces className="h-4 w-4" />
              </IconBtn>
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
          <SceneList
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
            getSectionDomId={sectionDomId}
          />

          <AddSectionButtons addSection={addEditorSection} />

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
        <CopyToPartialDialog
          open={copyPartialDialogOpen}
          onOpenChange={setCopyPartialDialogOpen}
          onCopy={copyTemplateToPartial}
          onSkip={() => {
            setCopyPartialDialogOpen(false);
            openPartials();
          }}
        />
      </div>
    </BuilderModeProvider>
  );
};

function partialDraftFromTemplateState(state: EditorState): TemplatePartial {
  const fallbackName = state.name.trim() || state.id || 'template';

  return partialFromDraftState({
    ...state,
    id: `local:${fallbackName}`,
    name: fallbackName,
    description: state.description.trim() || `Partial copied from ${fallbackName}`,
  });
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

const CopyToPartialDialog = ({
  open,
  onOpenChange,
  onCopy,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
  onSkip: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create a partial from this template?</DialogTitle>
        <DialogDescription>
          The partial page can open with this template's current scenes copied into a new unsaved partial.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Cancel
        </Button>
        <Button variant="secondary" type="button" onClick={onSkip}>
          Open partials
        </Button>
        <Button variant="primary" type="button" onClick={onCopy}>
          Copy template
        </Button>
      </div>
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
          className={EDITOR_INPUT_CLASS}
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
              className={EDITOR_INPUT_CLASS}
              value={variable.name}
              onChange={(e) => {
                update(i, { name: e.target.value });
              }}
              placeholder="name"
            />
            <input
              aria-label={`Variable ${i + 1} value`}
              className={EDITOR_INPUT_CLASS}
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
