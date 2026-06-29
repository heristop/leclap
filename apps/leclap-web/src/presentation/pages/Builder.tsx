import { useEffect, useRef, useState, type RefObject } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExportPanel } from '@/presentation/components/ExportPanel';
import { Seo } from '@/presentation/components/Seo';
import { EditorShell, CompileMonitor, type SaveStatus } from '@/presentation/components/builder';
import { EditorLoadingShell } from '@/presentation/components/builder/editor-loading-shell';
import { useVideoProcessing, type ProcessedVideo, type MediaChoices } from '@/hooks/useVideoProcessing';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { templateService, type Template, type InputSection } from '@/services/templateService';
import { findMusicByUrl } from '@/data/mediaCatalog';
import { type VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { MediaChoice } from '@/presentation/components/admin/templateEditorModel';
import { type WizardModel, EMPTY_MODEL } from '@/lib/wizardModel';
import { addRush, selectRush, removeRush } from '@/lib/rushActions';
import { loadProject, loadOutput, saveDraft, saveCompleted } from '@/services/projectService';
import { Loader2 } from '@/presentation/components/icons';
import { ArrowLeftIcon } from '@/presentation/components/icons/arrow-left';
import { ArrowRightIcon } from '@/presentation/components/icons/arrow-right';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { Button, Card, Reveal } from '@/presentation/components/ui';

// The template's default soundtrack as a library MediaChoice, so the Music step opens pre-selected on
// the track the template was authored with. Only when music is enabled and the default is one of the
// offered tracks; otherwise null (leave the step empty).
const defaultMusicChoice = (template: Template): MediaChoice | null => {
  const global = template.descriptor.global;
  const name = global?.music?.name;

  if (!global?.musicEnabled || !name) return null;

  const track = findMusicByUrl(`/musics/${name}`);

  if (!track) return null;

  const allowed = global.allowedMusic;

  if (allowed && allowed.length > 0 && !allowed.includes(track.id)) return null;

  return { source: 'library', id: track.id };
};

// ── Dynamic, section-driven step model ─────────────────────────────────────────────────────────
// The wizard walks the template's sections IN ORDER: a step per `form` section and a step per
// `project_video` clip, then (if the template offers media) a Music/Background step, then Create
// and Result. Each input step is gated — you can't advance until it's complete.
type WizardStep =
  | { kind: 'template' }
  | { kind: 'form'; sectionName: string; section: InputSection }
  | { kind: 'clip'; sectionName: string; clipIndex: number; section: InputSection }
  | { kind: 'media' }
  | { kind: 'process' }
  | { kind: 'result' };

const templateNeedsMediaStep = (template: Template): boolean => {
  const g = template.descriptor.global ?? {};

  return (
    (g.allowedMusic?.length ?? 0) > 0 ||
    Boolean(g.allowUploadMusic) ||
    (g.allowedBackgrounds?.length ?? 0) > 0 ||
    Boolean(g.allowUploadBackground)
  );
};

const totalClips = (template: Template): number =>
  templateService.orderedInputSections(template.descriptor).filter((s) => s.kind === 'clip').length;

// Build the ordered step list for a chosen template.
const buildSteps = (template: Template): WizardStep[] => {
  const steps: WizardStep[] = [{ kind: 'template' }];

  for (const section of templateService.orderedInputSections(template.descriptor)) {
    if (section.kind === 'form') {
      steps.push({ kind: 'form', sectionName: section.name, section });
      continue;
    }

    steps.push({ kind: 'clip', sectionName: section.name, clipIndex: section.clipIndex, section });
  }

  if (templateNeedsMediaStep(template)) {
    steps.push({ kind: 'media' });
  }

  steps.push({ kind: 'process' }, { kind: 'result' });

  return steps;
};

interface BuilderState {
  selectedTemplate: Template | null;
  clipsBySection: Record<string, File>;
  rushesBySection: Record<string, File[]>;
  formData: Record<string, string>;
  musicChoice: MediaChoice | null;
  backgroundChoice: MediaChoice | null;
}

// Whether a single step's required input is satisfied.
const isStepComplete = (step: WizardStep, s: BuilderState): boolean => {
  if (step.kind === 'form') {
    const fields = s.selectedTemplate
      ? templateService.extractFormFieldsForSection(s.selectedTemplate.descriptor, step.sectionName)
      : [];

    return fields.every((f) => (s.formData[f.name] ?? '').trim() !== '');
  }

  if (step.kind === 'clip') {
    return Boolean(s.clipsBySection[step.sectionName]);
  }

  return true; // template/media/process/result never block forward movement
};

// Every input step (form + clip) complete → the template is ready to compile.
const allInputsComplete = (steps: WizardStep[], s: BuilderState): boolean =>
  steps.filter((st) => st.kind === 'form' || st.kind === 'clip').every((st) => isStepComplete(st, s));

// ── Shared step screens ────────────────────────────────────────────────────────────────────────

interface StepProcessProps {
  selectedTemplate: Template | null;
  clipFiles: File[];
  formData: Record<string, string>;
  isProcessing: boolean;
  progress: ReturnType<typeof useVideoProcessing>['progress'];
  error: string | null;
  onCancelProcessing: () => void;
}

const StepProcess = ({
  selectedTemplate,
  clipFiles,
  formData,
  isProcessing,
  progress,
  error,
  onCancelProcessing,
}: StepProcessProps) => {
  if (!selectedTemplate) return null;

  return (
    <CompileMonitor
      template={selectedTemplate}
      clipFiles={clipFiles}
      formData={formData}
      isProcessing={isProcessing}
      progress={progress}
      error={error}
      onCancel={onCancelProcessing}
    />
  );
};

const StepResult = ({
  processedVideo,
  onBack,
  onReset,
}: {
  processedVideo: ProcessedVideo;
  onBack: () => void;
  onReset: () => void;
}) => {
  const { t } = useTranslation('builder');
  const { ref: backRef, hoverProps: backHoverProps } = useIconHover();
  const { ref: resetRef, hoverProps: resetHoverProps } = useIconHover();

  return (
    <div className="fade-in text-center max-w-4xl mx-auto">
      <div className="mb-12">
        <h2 className="text-5xl font-bold font-display brand-gradient-text mb-4">{t('stepResult.title')}</h2>
        <p className="text-gray-300 text-lg">{t('stepResult.subtitle')}</p>
      </div>
      <Reveal>
        <Card elevation="flat" className="glass-panel-dark p-8 md:p-12 shadow-2xl">
          <ExportPanel processedVideo={processedVideo} />
          <div className="mt-8 flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-foreground/5 hover:bg-foreground/10"
              {...backHoverProps}
            >
              <ArrowLeftIcon ref={backRef} size={18} />
              <span>{t('actions.back', { ns: 'common' })}</span>
            </Button>
            <Button variant="link" onClick={onReset} className="w-full sm:w-auto px-6 py-3" {...resetHoverProps}>
              <span>{t('stepResult.createAnother')}</span>
              <ArrowRightIcon ref={resetRef} size={18} />
            </Button>
          </div>
        </Card>
      </Reveal>
    </div>
  );
};

interface StepContentProps {
  step: WizardStep;
  selectedTemplate: Template | null;
  model: WizardModel;
  clipCount: number;
  processedVideo: ProcessedVideo | null;
  processing: {
    isFFmpegReady: boolean;
    isProcessing: boolean;
    canProcess: boolean;
    progress: ProcessProgress;
    error: string | null;
  };
  onFormDataChange: (d: Record<string, string>) => void;
  onClipChange: (sectionName: string, file: File | undefined) => void;
  onEditChange: (sectionName: string, edit: VideoEdit | undefined) => void;
  onMusicChange: (c: MediaChoice | null) => void;
  onBackgroundChange: (c: MediaChoice | null) => void;
  onStartProcessing: () => void;
  onCancelProcessing: () => void;
  onResultBack: () => void;
  onReset: () => void;
}

// Renders the shared phases that live outside the editor shell: compile and result. Template picking
// now lives on the studio home (/studio); per-section input editing belongs to the shell itself.
const StepContent = (p: StepContentProps) => {
  const { step, selectedTemplate, model } = p;

  if (step.kind === 'process') {
    return (
      <StepProcess
        selectedTemplate={selectedTemplate}
        clipFiles={Object.values(model.clipsBySection)}
        formData={model.formData}
        isProcessing={p.processing.isProcessing}
        progress={p.processing.progress}
        error={p.processing.error}
        onCancelProcessing={p.onCancelProcessing}
      />
    );
  }

  if (p.processedVideo) {
    return <StepResult processedVideo={p.processedVideo} onBack={p.onResultBack} onReset={p.onReset} />;
  }

  return null;
};

type ProcessProgress = ReturnType<typeof useVideoProcessing>['progress'];

// Callbacks the flow needs — bundled so the flow component takes one prop instead of a dozen.
interface WizardHandlers {
  onFormDataChange: (d: Record<string, string>) => void;
  onClipChange: (sectionName: string, file: File | undefined) => void;
  onAddRush: (sectionName: string, file: File) => void;
  onSelectRush: (sectionName: string, file: File) => void;
  onRemoveRush: (sectionName: string, file: File) => void;
  onEditChange: (sectionName: string, edit: VideoEdit | undefined) => void;
  onMusicChange: (c: MediaChoice | null) => void;
  onBackgroundChange: (c: MediaChoice | null) => void;
  onStartProcessing: () => void;
  onCancelProcessing: () => void;
  onResultBack: () => void;
  onReset: () => void;
}

interface FlowProps {
  selectedTemplate: Template | null;
  model: WizardModel;
  steps: WizardStep[];
  stepIndex: number;
  clipCount: number;
  builderState: BuilderState;
  allComplete: boolean;
  processedVideo: ProcessedVideo | null;
  processing: {
    isFFmpegReady: boolean;
    isProcessing: boolean;
    canProcess: boolean;
    progress: ProcessProgress;
    error: string | null;
  };
  handlers: WizardHandlers;
  goTo: (i: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
}

// Index of the process / result steps, used by the hub to reuse the shared screens for those phases.
const processIndex = (steps: WizardStep[]): number => steps.findIndex((s) => s.kind === 'process');
const resultIndex = (steps: WizardStep[]): number => steps.findIndex((s) => s.kind === 'result');

// The editor flow: EditorShell → Process → Result. The Process and Result phases reuse the linear
// screens via StepContent so there's a single source of truth for them. The template chooser now
// lives on the studio home — with nothing selected, the editor has nothing to edit, so bounce there.
const HubFlow = (p: FlowProps) => {
  const { selectedTemplate, model, steps, stepIndex, handlers } = p;

  if (!selectedTemplate) {
    return <Navigate to="/studio" replace />;
  }

  // One fullscreen editor shell hosts every phase: editing scenes, the compile, and the result. The
  // compile/result phases reuse the linear StepContent screens, rendered inside the shell's body.
  const onProcess = stepIndex === processIndex(steps);
  const onResult = stepIndex === resultIndex(steps);
  const derivePhase = (): 'edit' | 'processing' | 'result' => {
    if (p.processedVideo) return 'result';

    if (onProcess || onResult || p.processing.isProcessing) return 'processing';

    return 'edit';
  };
  const phase = derivePhase();

  const phaseContent =
    phase === 'edit' ? null : (
      <StepContent
        step={steps[onResult || p.processedVideo ? resultIndex(steps) : processIndex(steps)]}
        selectedTemplate={selectedTemplate}
        model={model}
        clipCount={p.clipCount}
        processedVideo={p.processedVideo}
        processing={p.processing}
        onFormDataChange={handlers.onFormDataChange}
        onClipChange={handlers.onClipChange}
        onEditChange={handlers.onEditChange}
        onMusicChange={handlers.onMusicChange}
        onBackgroundChange={handlers.onBackgroundChange}
        onStartProcessing={handlers.onStartProcessing}
        onCancelProcessing={handlers.onCancelProcessing}
        onResultBack={handlers.onResultBack}
        onReset={handlers.onReset}
      />
    );

  return (
    <EditorShell
      template={selectedTemplate}
      model={model}
      clipCount={p.clipCount}
      showMedia={templateNeedsMediaStep(selectedTemplate)}
      allComplete={p.allComplete}
      phase={phase}
      phaseContent={phaseContent}
      saveStatus={p.saveStatus}
      lastSavedAt={p.lastSavedAt}
      onFormDataChange={handlers.onFormDataChange}
      onClipChange={handlers.onClipChange}
      onAddRush={handlers.onAddRush}
      onSelectRush={handlers.onSelectRush}
      onRemoveRush={handlers.onRemoveRush}
      onEditChange={handlers.onEditChange}
      onMusicChange={handlers.onMusicChange}
      onBackgroundChange={handlers.onBackgroundChange}
      onCreate={() => {
        p.goTo(processIndex(steps));
        handlers.onStartProcessing();
      }}
      onCancel={handlers.onCancelProcessing}
      onExit={handlers.onReset}
    />
  );
};

// Inputs needed to assemble the shared handler bundle. Kept as a single arg object so the helper
// stays under the max-params limit.
interface ActionDeps {
  model: WizardModel;
  selectedTemplate: Template | null;
  steps: WizardStep[];
  stepIndex: number;
  allComplete: boolean;
  error: string | null;
  setSelectedTemplate: (t: Template | null) => void;
  setModel: (value: WizardModel | ((m: WizardModel) => WizardModel)) => void;
  processVideo: ReturnType<typeof useVideoProcessing>['processVideo'];
  cancelProcessing: ReturnType<typeof useVideoProcessing>['cancelProcessing'];
}

// Builds every callback the flows need. Pure factory (no hooks) so it doesn't bloat the component.
const makeWizardActions = (deps: ActionDeps) => {
  const { model, selectedTemplate, steps, stepIndex, allComplete, error, setSelectedTemplate, setModel } = deps;
  const update = (patch: Partial<WizardModel>) => {
    setModel((m) => ({ ...m, ...patch }));
  };
  const goTo = (i: number) => {
    update({ stepIndex: Math.min(Math.max(i, 0), steps.length - 1) });
  };
  // A clip arriving from the recorder/upload is a new take: append it as a rush (auto-selecting the
  // first). Clearing the clip removes the currently-selected take from the section.
  const setClip = (sectionName: string, file: File | undefined) => {
    setModel((m) => {
      if (file) return { ...m, ...addRush(m, sectionName, file) };

      if (!Object.hasOwn(m.clipsBySection, sectionName)) return m;

      return { ...m, ...removeRush(m, sectionName, m.clipsBySection[sectionName]) };
    });
  };
  const startProcessing = () => {
    if (!selectedTemplate || !allComplete) return;
    const mediaChoices: MediaChoices = { music: model.musicChoice, background: model.backgroundChoice };
    deps
      .processVideo(
        model.clipsBySection,
        { ...selectedTemplate, formData: model.formData },
        model.editsBySection,
        mediaChoices
      )
      .then(
        () => {
          if (!error) update({ stepIndex: steps.findIndex((s) => s.kind === 'result') });
        },
        (error_: unknown) => {
          console.error('Processing error', error_);
        }
      );
  };
  const handlers: WizardHandlers = {
    onFormDataChange: (d) => {
      update({ formData: d });
    },
    onClipChange: setClip,
    onAddRush: (sectionName, file) => {
      setModel((m) => ({ ...m, ...addRush(m, sectionName, file) }));
    },
    onSelectRush: (sectionName, file) => {
      setModel((m) => ({ ...m, ...selectRush(m, sectionName, file) }));
    },
    onRemoveRush: (sectionName, file) => {
      setModel((m) => ({ ...m, ...removeRush(m, sectionName, file) }));
    },
    onEditChange: (name, edit) => {
      update({ editsBySection: { ...model.editsBySection, [name]: edit } });
    },
    onMusicChange: (c) => {
      update({ musicChoice: c });
    },
    onBackgroundChange: (c) => {
      update({ backgroundChoice: c });
    },
    onStartProcessing: startProcessing,
    onCancelProcessing: deps.cancelProcessing,
    onResultBack: () => {
      update({ stepIndex: 1 });
    },
    onReset: () => {
      setSelectedTemplate(null);
      setModel(EMPTY_MODEL);
    },
  };

  return {
    handlers,
    goTo,
    nextStep: () => {
      goTo(stepIndex + 1);
    },
    prevStep: () => {
      goTo(stepIndex - 1);
    },
  };
};

interface PersistenceArgs {
  selectedTemplate: Template | null;
  model: WizardModel;
  currentStepKind: WizardStep['kind'] | undefined;
  isProcessing: boolean;
  processedVideo: ProcessedVideo | null;
  setSelectedTemplate: (template: Template | null) => void;
  setModel: (model: WizardModel) => void;
}

// For a completed project decide where to open it: `edit` drops into the first input step (no result
// loaded); otherwise jump to the result step and materialize the rendered video for re-viewing.
const resolveCompletedOpen = async (
  result: Extract<Awaited<ReturnType<typeof loadProject>>, { ok: true }>,
  edit: boolean
): Promise<{ stepIndex: number; hydrated: ProcessedVideo | null }> => {
  const steps = buildSteps(result.template);

  if (edit) {
    const inputIndex = steps.findIndex((step) => step.kind === 'form' || step.kind === 'clip');

    return { stepIndex: inputIndex >= 0 ? inputIndex : result.model.stepIndex, hydrated: null };
  }

  const resultIndex = steps.findIndex((step) => step.kind === 'result');
  const output = await loadOutput(result.project);
  const hydrated = output
    ? { blob: output.blob, url: URL.createObjectURL(output.blob), size: output.size, duration: output.duration }
    : null;

  return { stepIndex: resultIndex >= 0 ? resultIndex : result.model.stepIndex, hydrated };
};

// Functional URL updater that swaps the volatile `?template=` for the durable `?projectId=` once a
// draft exists. Returned as an updater so the save effect avoids closing over a stale `projectIdParam`.
const reflectProjectId =
  (projectId: string) =>
  (prev: URLSearchParams): URLSearchParams => {
    if (prev.get('projectId') === projectId) return prev;
    const next = new URLSearchParams(prev);
    next.delete('template');
    next.set('projectId', projectId);

    return next;
  };

// Prompt before unload while `dirty` (an edit awaiting its debounced/in-flight save). A clean
// session attaches nothing, so it never prompts. Both calls are needed for cross-browser support.
const useUnsavedChangesWarning = (dirty: boolean) => {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // preventDefault is the spec path; the legacy returnValue assignment keeps Chrome/Safari prompting.
      e.preventDefault();
      (e as { returnValue: string }).returnValue = '';
    };

    if (dirty) window.addEventListener('beforeunload', handler);

    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [dirty]);
};

interface AutoSaveArgs {
  selectedTemplate: Template | null;
  model: WizardModel;
  currentStepKind: WizardStep['kind'] | undefined;
  isProcessingRef: RefObject<boolean>;
  hydratingRef: RefObject<boolean>;
  skipNextSaveRef: RefObject<boolean>;
  currentProjectIdRef: RefObject<string | null>;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
}

// A draft is worth persisting only once it carries real user input — a recorded/uploaded clip, an
// entered form field, or a video edit. A freshly-opened template (which already carries its default
// soundtrack) is otherwise empty and must NOT spawn a stored project, or the library fills with blank
// "0 clips" drafts the user never actually started.
const modelHasContent = (model: WizardModel): boolean =>
  Object.keys(model.clipsBySection).length > 0 ||
  Object.values(model.rushesBySection).some((takes) => takes.length > 0) ||
  Object.values(model.formData).some((value) => value.trim() !== '') ||
  Object.values(model.editsBySection).some(Boolean);

// Debounced draft auto-save (only while editing an input step) plus the unsaved-changes prompt.
// Extracted from useProjectPersistence to keep that hook within its statement budget.
const useDraftAutoSave = (args: AutoSaveArgs) => {
  const { selectedTemplate, model, currentStepKind, isProcessingRef, hydratingRef } = args;
  const { skipNextSaveRef, currentProjectIdRef, setSearchParams } = args;
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // Dirty since the last edit but the debounced save hasn't landed — guards the close/refresh window.
  const [pendingSave, setPendingSave] = useState(false);

  useEffect(() => {
    const onResultOrProcess = currentStepKind === 'process' || currentStepKind === 'result';
    // Don't auto-save an empty draft — only persist once the project has real content (see above).
    const blocked =
      !selectedTemplate ||
      onResultOrProcess ||
      isProcessingRef.current ||
      hydratingRef.current ||
      !modelHasContent(model);
    let handle: ReturnType<typeof setTimeout> | undefined;

    if (!blocked) {
      const consume = skipNextSaveRef.current;
      skipNextSaveRef.current = false;

      if (!consume) {
        const template = selectedTemplate;
        setPendingSave(true);
        handle = setTimeout(() => {
          setSaveStatus('saving');
          saveDraft(model, template, currentProjectIdRef.current ?? undefined)
            .then((saved) => {
              currentProjectIdRef.current = saved.id;
              // Reflect the auto-created id into the URL so a refresh resumes THIS draft (not a blank build).
              setSearchParams(reflectProjectId(saved.id), { replace: true });
              setSaveStatus('saved');
              setLastSavedAt(Date.now());
              setPendingSave(false);
            })
            .catch(() => {
              // Keep pendingSave true — the change is still unsaved.
              setSaveStatus('error');
            });
        }, 600);
      }
    }

    return () => {
      if (handle) clearTimeout(handle);
    };
  }, [
    model,
    selectedTemplate,
    currentStepKind,
    setSearchParams,
    isProcessingRef,
    hydratingRef,
    skipNextSaveRef,
    currentProjectIdRef,
  ]);

  useUnsavedChangesWarning(pendingSave || saveStatus === 'saving');

  return { saveStatus, lastSavedAt };
};

// Owns project persistence for the builder: hydrating from `?projectId`, debounced draft auto-save,
// and recording the finished render. Split out so useBuilderController stays small.
const useProjectPersistence = (args: PersistenceArgs) => {
  const { selectedTemplate, model, currentStepKind, isProcessing, processedVideo, setSelectedTemplate, setModel } =
    args;
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get('projectId');

  // The project this session writes to (assigned on the first auto-save, or on hydration).
  const currentProjectIdRef = useRef<string | null>(null);
  // Suppresses the no-op auto-save that the state update right after hydration would otherwise trigger.
  const skipNextSaveRef = useRef(false);
  // The output blob already persisted, so re-renders don't re-save the same finished video.
  const savedOutputRef = useRef<Blob | null>(null);
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;
  const [hydrating, setHydrating] = useState(Boolean(projectIdParam));
  const hydratingRef = useRef(hydrating);
  hydratingRef.current = hydrating;
  // A completed project's output, materialized from IndexedDB so the result re-opens without a recompile.
  const [hydratedResult, setHydratedResult] = useState<ProcessedVideo | null>(null);

  useEffect(() => {
    // Read the cancel flag through a function so the linter can't narrow it to a literal (which a
    // closed-over boolean it sees only assigned `false`/`true` otherwise becomes).
    const run = { cancelled: false };
    const cancelled = () => run.cancelled;
    // `?edit=1` re-opens a completed project at its inputs (to change & re-render) rather than its result.
    const editParam = searchParams.get('edit') === '1';

    // The URL change we make after our own first save lands back here — don't reload from disk
    // (it would clobber in-memory state and flash `hydrating`); the live session already owns this id.
    if (projectIdParam && projectIdParam === currentProjectIdRef.current) {
      return () => {
        run.cancelled = true;
      };
    }

    if (projectIdParam) {
      setHydrating(true);
      loadProject(projectIdParam)
        .then(async (result) => {
          if (cancelled()) return;

          if (!result.ok) {
            setHydrating(false);

            return;
          }

          skipNextSaveRef.current = true;
          currentProjectIdRef.current = result.project.id;
          setSelectedTemplate(result.template);

          let nextModel = result.model;

          if (result.project.status === 'completed') {
            const opened = await resolveCompletedOpen(result, editParam);
            nextModel = { ...result.model, stepIndex: opened.stepIndex };

            if (!cancelled() && opened.hydrated) {
              savedOutputRef.current = opened.hydrated.blob;
              setHydratedResult(opened.hydrated);
            }
          }

          if (cancelled()) return;

          setModel(nextModel);
          setHydrating(false);
        })
        .catch(() => {
          if (!cancelled()) setHydrating(false);
        });
    }

    return () => {
      run.cancelled = true;
    };
  }, [projectIdParam, searchParams, setSelectedTemplate, setModel]);

  useEffect(
    () => () => {
      if (hydratedResult) URL.revokeObjectURL(hydratedResult.url);
    },
    [hydratedResult]
  );

  // Debounced draft auto-save (only while editing an input step) plus the unsaved-changes prompt.
  const { saveStatus, lastSavedAt } = useDraftAutoSave({
    selectedTemplate,
    model,
    currentStepKind,
    isProcessingRef,
    hydratingRef,
    skipNextSaveRef,
    currentProjectIdRef,
    setSearchParams,
  });

  // Record a finished render against the current project.
  useEffect(() => {
    const projectId = currentProjectIdRef.current;
    const output = processedVideo;

    if (output && projectId && savedOutputRef.current !== output.blob) {
      savedOutputRef.current = output.blob;
      saveCompleted(projectId, { blob: output.blob, size: output.size, duration: output.duration }).catch(
        (saveError: unknown) => {
          console.error('Saving finished video failed', saveError);
        }
      );
    }
  }, [processedVideo]);

  const resetProject = () => {
    currentProjectIdRef.current = null;
    skipNextSaveRef.current = true;
    savedOutputRef.current = null;
    setHydratedResult(null);

    if (projectIdParam) setSearchParams({}, { replace: true });
  };

  // Clear only the hydrated (saved-project) result without tearing down the project id / URL, so
  // "Back" from the result screen returns to editing the SAME draft.
  const clearHydratedResult = () => {
    savedOutputRef.current = null;
    setHydratedResult(null);
  };

  return { hydrating, hydratedResult, resetProject, clearHydratedResult, saveStatus, lastSavedAt };
};

interface PreselectArgs {
  setSelectedTemplate: (template: Template | null) => void;
  setModel: (model: WizardModel) => void;
  // The template handed in via nav state (gallery click). When present we already have it synchronously,
  // so the editor renders its titlebar in the first frame — letting the card-title View Transition land —
  // and the async fetch below is skipped.
  presetId: string | null;
}

// `/studio/new?template=<id>` (no project) opens the editor straight on a template: fetch it and seed
// the empty model with its default soundtrack — the same effect as picking it in the gallery. The
// `appliedRef` guards against re-running the apply for an id we've already handled, so the effect
// can't loop on its own setState (which leaves the param untouched).
const useTemplatePreselect = ({ setSelectedTemplate, setModel, presetId }: PreselectArgs) => {
  const [searchParams] = useSearchParams();
  const templateParam = searchParams.get('template');
  const projectIdParam = searchParams.get('projectId');
  // A nav-state template for the current param is already applied, so seed appliedRef and never resolve.
  const appliedRef = useRef<string | null>(presetId && presetId === templateParam ? templateParam : null);
  const [resolving, setResolving] = useState(
    Boolean(templateParam) && !projectIdParam && appliedRef.current !== templateParam
  );

  useEffect(() => {
    const pending = { cancelled: false };
    const skip = Boolean(projectIdParam) || !templateParam || appliedRef.current === templateParam;

    if (skip) {
      setResolving(false);
    }

    if (!skip && templateParam) {
      setResolving(true);
      templateService
        .getTemplate(templateParam)
        .then((template) => {
          if (pending.cancelled) return;
          appliedRef.current = templateParam;

          if (template) {
            setSelectedTemplate(template);
            setModel({ ...EMPTY_MODEL, musicChoice: defaultMusicChoice(template) });
          }

          setResolving(false);
        })
        .catch(() => {
          if (!pending.cancelled) setResolving(false);
        });
    }

    return () => {
      pending.cancelled = true;
    };
  }, [templateParam, projectIdParam, setSelectedTemplate, setModel]);

  return { templateParam, projectIdParam, resolving };
};

// The template a gallery click hands over through router nav state (so the editor renders synchronously
// and the card-title View Transition has a target). Null for direct loads / refreshes, which re-fetch.
const navStateTemplate = (state: unknown): Template | null =>
  (state as { template?: Template } | null)?.template ?? null;

// A project open (/projects) can't hand over a full template synchronously — it hydrates async from
// `?projectId`. So it passes only the project NAME through nav state, letting the loading branch render
// a `studio-title` target that the project-card title morphs into. Kept distinct from the `template`
// key above so it never seeds builder state.
const navStateProjectTitle = (state: unknown): string | null =>
  (state as { projectTitle?: string } | null)?.projectTitle ?? null;

// Seed the wizard model on a preselected template with its default soundtrack, matching gallery pick.
const initialModelFor = (template: Template | null): WizardModel =>
  template ? { ...EMPTY_MODEL, musicChoice: defaultMusicChoice(template) } : EMPTY_MODEL;

const templateId = (template: Template | null): string | null => template?.id ?? null;

// Owns all wizard state + derived values + actions, so the Builder component is render-only.
const useBuilderController = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const presetTemplate = navStateTemplate(location.state);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(presetTemplate);
  const [model, setModel] = useState<WizardModel>(() => initialModelFor(presetTemplate));
  const { isProcessing, progress, processedVideo, error, processVideo, cancelProcessing, clearResults, isFFmpegReady } =
    useVideoProcessing();
  const { templateParam, projectIdParam, resolving } = useTemplatePreselect({
    setSelectedTemplate,
    setModel,
    presetId: templateId(presetTemplate),
  });
  const steps: WizardStep[] = selectedTemplate ? buildSteps(selectedTemplate) : [{ kind: 'template' }];
  const stepIndex = Math.min(model.stepIndex, steps.length - 1);
  const currentStepKind = steps[stepIndex]?.kind;
  const clipCount = selectedTemplate ? totalClips(selectedTemplate) : 0;
  const builderState: BuilderState = { ...model, selectedTemplate };
  const allComplete = allInputsComplete(steps, builderState);

  const { hydrating, hydratedResult, resetProject, clearHydratedResult, saveStatus, lastSavedAt } =
    useProjectPersistence({
      selectedTemplate,
      model,
      currentStepKind,
      isProcessing,
      processedVideo,
      setSelectedTemplate,
      setModel,
    });

  const actions = makeWizardActions({
    model,
    selectedTemplate,
    steps,
    stepIndex,
    allComplete,
    error,
    setSelectedTemplate,
    setModel,
    processVideo,
    cancelProcessing,
  });

  const handlers: WizardHandlers = {
    ...actions.handlers,
    // "Back" from the result screen: the result view is rendered whenever a processed video exists
    // (regardless of stepIndex), so clear BOTH the fresh-process result and any hydrated one — else the
    // guard keeps re-showing the result and Back appears to do nothing — then return to the last input
    // step to keep editing the same draft.
    onResultBack: () => {
      clearResults();
      clearHydratedResult();
      const backTo = Math.max(0, processIndex(steps) - 1);
      setModel((m) => ({ ...m, stepIndex: backTo }));
    },
    // "Change template" / back: leave the editor and return to the gallery to pick another. The
    // unmount tears down the session; resetProject still runs so any in-flight project ref is cleared.
    onReset: () => {
      resetProject();
      Promise.resolve(navigate('/studio')).catch(() => {});
    },
  };

  const flowProps: FlowProps = {
    selectedTemplate,
    model,
    steps,
    stepIndex,
    clipCount,
    builderState,
    allComplete,
    processedVideo: processedVideo ?? hydratedResult,
    processing: {
      isFFmpegReady,
      isProcessing,
      canProcess: Boolean(selectedTemplate) && isFFmpegReady && allComplete,
      progress,
      error,
    },
    handlers,
    goTo: actions.goTo,
    nextStep: actions.nextStep,
    prevStep: actions.prevStep,
    saveStatus,
    lastSavedAt,
  };

  // Nothing to edit (no template/project param and nothing selected) → the chooser lives on /studio.
  const needsTemplate = !templateParam && !projectIdParam && !selectedTemplate && !resolving && !hydrating;

  // Title hint a project open passes through nav state — the morph target while the project hydrates.
  const projectTitle = navStateProjectTitle(location.state);

  return { isFFmpegReady, hydrating, resolving, flowProps, needsTemplate, projectTitle };
};

export const Builder = () => {
  const { t } = useTranslation('builder');
  const { loadingProgress } = useFFmpeg();
  const { isFFmpegReady, hydrating, resolving, flowProps, needsTemplate, projectTitle } = useBuilderController();

  // No template/project to edit → send the user to the gallery to pick one.
  if (needsTemplate) {
    return <Navigate to="/studio" replace />;
  }

  return (
    <div className="dark min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden">
      <h1 className="sr-only">{t('srHeading')}</h1>
      <Seo
        title={t('studio.title', { ns: 'seo' })}
        description={t('studio.description', { ns: 'seo' })}
        path="/studio/new"
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/15 rounded-full blur-[120px] animate-float" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-400/10 rounded-full blur-[120px] animate-float"
          style={{ animationDelay: '-3s' }}
        />
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-24 relative z-10">
        {hydrating || resolving ? (
          <>
            {/* A project open carries its title via nav state: render the editor-shaped loading shell so
                the `studio-title` morph from the card lands in the title's FINAL position (the real
                EditorShell then mounts in the identical spot — no jump). */}
            {projectTitle && <EditorLoadingShell title={projectTitle} />}
            {!projectTitle && (
              <div className="fade-in flex min-h-[40vh] flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="h-7 w-7 animate-spin text-brand-500 motion-reduce:animate-none" />
                <p className="text-sm font-medium">{t('project.loading')}</p>
              </div>
            )}
          </>
        ) : (
          <HubFlow {...flowProps} />
        )}
        {!isFFmpegReady && (
          <Card
            elevation="flat"
            className="fixed bottom-6 right-6 max-w-sm glass-panel-dark rounded-xl shadow-2xl p-4 border-warning/20 z-50 fade-in"
          >
            <div className="flex items-center space-x-3 mb-2">
              <Loader2 className="w-5 h-5 text-warning animate-spin" />
              <span className="font-semibold text-warning">{t('loadingEngine')}</span>
              <span className="ml-auto font-bold text-warning">{Math.round(loadingProgress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-warning transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
