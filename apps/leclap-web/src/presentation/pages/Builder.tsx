import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TemplateSelector } from '@/presentation/components/TemplateSelector';
import { VideoProcessor } from '@/presentation/components/VideoProcessor';
import { BrowserCompatibility } from '@/presentation/components/BrowserCompatibility';
import { ProgressDisplay } from '@/presentation/components/ProgressDisplay';
import { ExportPanel } from '@/presentation/components/ExportPanel';
import { Seo } from '@/presentation/components/Seo';
import { SectionHub } from '@/presentation/components/builder';
import { useVideoProcessing, type ProcessedVideo, type MediaChoices } from '@/hooks/useVideoProcessing';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { templateService, type Template, type InputSection } from '@/services/templateService';
import { type VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { MediaChoice } from '@/presentation/components/admin/templateEditorModel';
import { type WizardModel, EMPTY_MODEL } from '@/lib/wizardModel';
import { loadProject, loadOutput, saveDraft, saveCompleted } from '@/services/projectService';
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { Button, Card, Reveal } from '@/presentation/components/ui';
import { cn } from '@/lib/utils';

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

const StepTemplate = ({
  selectedTemplate,
  onTemplateSelected,
}: {
  selectedTemplate: Template | null;
  onTemplateSelected: (t: Template) => void;
}) => {
  const { t } = useTranslation('builder');

  return (
    <div className="space-y-8 fade-in">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold font-display text-foreground mb-2">{t('stepTemplate.title')}</h2>
        <p className="text-gray-400 text-lg">{t('stepTemplate.subtitle')}</p>
      </div>
      <TemplateSelector onTemplateSelected={onTemplateSelected} selectedTemplate={selectedTemplate} />
    </div>
  );
};

interface StepProcessProps {
  selectedTemplate: Template | null;
  clipFiles: File[];
  formData: Record<string, string>;
  isFFmpegReady: boolean;
  isProcessing: boolean;
  canProcess: boolean;
  progress: ReturnType<typeof useVideoProcessing>['progress'];
  error: string | null;
  onStartProcessing: () => void;
  onCancelProcessing: () => void;
}

const StepProcess = ({
  selectedTemplate,
  clipFiles,
  formData,
  isFFmpegReady,
  isProcessing,
  canProcess,
  progress,
  error,
  onStartProcessing,
  onCancelProcessing,
}: StepProcessProps) => {
  const { t } = useTranslation('builder');
  const progressRef = useRef<HTMLDivElement>(null);

  // The progress panel renders below the summary/compile cards, so on a short viewport it lands below
  // the fold. Pull it into view the moment compilation starts so the user always sees the loading.
  useEffect(() => {
    if (isProcessing) progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isProcessing]);

  return (
    <div className="fade-in max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold font-display text-foreground mb-2">{t('stepProcess.title')}</h2>
        <p className="text-gray-400 text-lg">{t('stepProcess.subtitle')}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <Card elevation="flat" className="glass-panel-dark p-8 shadow-2xl h-full">
          <h3 className="text-xl font-semibold mb-6 font-display text-brand-700 dark:text-brand-300 flex items-center">
            <Sparkles className="w-5 h-5 mr-2" />
            {t('stepProcess.summary')}
          </h3>
          <ul className="space-y-4 text-gray-300">
            <li className="flex justify-between items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/5">
              <span className="text-gray-400">{t('stepProcess.template')}</span>
              <span className="font-medium text-foreground truncate">{selectedTemplate?.name}</span>
            </li>
            {clipFiles.length > 0 && (
              <li className="flex justify-between items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/5">
                <span className="text-gray-400">{t('stepProcess.clips')}</span>
                <span className="font-medium text-foreground">
                  {t('stepProcess.videoCount', { count: clipFiles.length })}
                </span>
              </li>
            )}
            <li className="flex justify-between items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/5">
              <span className="text-gray-400">{t('stepProcess.engineStatus')}</span>
              <span
                className={cn(
                  'font-medium flex items-center',
                  isFFmpegReady ? 'text-success-foreground' : 'text-warning'
                )}
              >
                {isFFmpegReady ? (
                  <>
                    {t('stepProcess.ready')} <span className="ml-2 w-2 h-2 bg-success rounded-full animate-pulse" />
                  </>
                ) : (
                  <>
                    {t('stepProcess.initializing')} <Loader2 className="ml-2 w-3 h-3 animate-spin" />
                  </>
                )}
              </span>
            </li>
          </ul>
        </Card>
        <Card elevation="flat" className="glass-panel-dark p-8 shadow-2xl flex flex-col justify-center h-full">
          <VideoProcessor
            isProcessing={isProcessing}
            canProcess={canProcess}
            onStartProcessing={onStartProcessing}
            onCancelProcessing={onCancelProcessing}
            error={error}
            template={selectedTemplate}
            formData={formData}
            uploadedFiles={clipFiles}
          />
        </Card>
      </div>
      {isProcessing && (
        <Card
          ref={progressRef}
          elevation="flat"
          className="mt-8 glass-panel-dark p-8 shadow-xl ring-1 ring-brand-500/20 animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none scroll-mt-24"
        >
          <h3 className="text-xl font-semibold mb-4 font-display text-brand-700 dark:text-brand-300 flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('stepProcess.progress')}
          </h3>
          <ProgressDisplay progress={progress} />
        </Card>
      )}
    </div>
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
              className="group w-full sm:w-auto px-6 py-3 rounded-full bg-foreground/5 hover:bg-foreground/10"
            >
              <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1" />
              <span>{t('actions.back', { ns: 'common' })}</span>
            </Button>
            <Button variant="link" onClick={onReset} className="group w-full sm:w-auto px-6 py-3">
              <span>{t('stepResult.createAnother')}</span>
              <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
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
  onTemplateSelected: (t: Template) => void;
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

// Renders the shared phases that live outside the SectionHub: template pick, compile, and result.
// Per-section input editing belongs to the hub itself, not here.
const StepContent = (p: StepContentProps) => {
  const { step, selectedTemplate, model } = p;

  if (step.kind === 'template') {
    return <StepTemplate selectedTemplate={selectedTemplate} onTemplateSelected={p.onTemplateSelected} />;
  }

  if (step.kind === 'process') {
    return (
      <StepProcess
        selectedTemplate={selectedTemplate}
        clipFiles={Object.values(model.clipsBySection)}
        formData={model.formData}
        isFFmpegReady={p.processing.isFFmpegReady}
        isProcessing={p.processing.isProcessing}
        canProcess={p.processing.canProcess}
        progress={p.processing.progress}
        error={p.processing.error}
        onStartProcessing={p.onStartProcessing}
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
  onTemplateSelected: (t: Template) => void;
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
}

// Index of the process / result steps, used by the hub to reuse the shared screens for those phases.
const processIndex = (steps: WizardStep[]): number => steps.findIndex((s) => s.kind === 'process');
const resultIndex = (steps: WizardStep[]): number => steps.findIndex((s) => s.kind === 'result');

// The "all at once" flow: Template → SectionHub → Process → Result. The Process and Result phases
// reuse the linear screens via StepContent so there's a single source of truth for them.
const HubFlow = (p: FlowProps) => {
  const { selectedTemplate, model, steps, stepIndex, handlers } = p;

  if (!selectedTemplate) {
    return <StepTemplate selectedTemplate={selectedTemplate} onTemplateSelected={handlers.onTemplateSelected} />;
  }

  const onProcess = stepIndex === processIndex(steps);
  const onResult = stepIndex === resultIndex(steps);

  if (onProcess || onResult) {
    return (
      <div className="max-w-6xl mx-auto">
        <StepContent
          step={steps[stepIndex]}
          selectedTemplate={selectedTemplate}
          model={model}
          clipCount={p.clipCount}
          processedVideo={p.processedVideo}
          processing={p.processing}
          onTemplateSelected={handlers.onTemplateSelected}
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
      </div>
    );
  }

  return (
    <SectionHub
      template={selectedTemplate}
      model={model}
      clipCount={p.clipCount}
      showMediaRow={templateNeedsMediaStep(selectedTemplate)}
      allComplete={p.allComplete}
      onFormDataChange={handlers.onFormDataChange}
      onClipChange={handlers.onClipChange}
      onEditChange={handlers.onEditChange}
      onMusicChange={handlers.onMusicChange}
      onBackgroundChange={handlers.onBackgroundChange}
      onChangeTemplate={handlers.onReset}
      onCreate={() => {
        p.goTo(processIndex(steps));
        handlers.onStartProcessing();
      }}
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
  const setClip = (sectionName: string, file: File | undefined) => {
    setModel((m) => {
      const clipsBySection = { ...m.clipsBySection };

      if (file) clipsBySection[sectionName] = file;

      if (!file) delete clipsBySection[sectionName];

      // The clip changed, so its edit no longer applies.
      return { ...m, clipsBySection, editsBySection: { ...m.editsBySection, [sectionName]: undefined } };
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
    onTemplateSelected: (template) => {
      setSelectedTemplate(template);
      setModel(EMPTY_MODEL);
    },
    onFormDataChange: (d) => {
      update({ formData: d });
    },
    onClipChange: setClip,
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

  // Debounced draft auto-save — only while editing an input step (never on the process/result
  // screens, mid-render, or the no-op save right after hydration).
  useEffect(() => {
    const onResultOrProcess = currentStepKind === 'process' || currentStepKind === 'result';
    const blocked = !selectedTemplate || onResultOrProcess || isProcessingRef.current || hydratingRef.current;
    let handle: ReturnType<typeof setTimeout> | undefined;

    if (!blocked) {
      const consume = skipNextSaveRef.current;
      skipNextSaveRef.current = false;

      if (!consume) {
        const template = selectedTemplate;
        handle = setTimeout(() => {
          saveDraft(model, template, currentProjectIdRef.current ?? undefined)
            .then((saved) => {
              currentProjectIdRef.current = saved.id;
            })
            .catch((saveError: unknown) => {
              console.error('Project auto-save failed', saveError);
            });
        }, 600);
      }
    }

    return () => {
      if (handle) clearTimeout(handle);
    };
  }, [model, selectedTemplate, currentStepKind]);

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

  return { hydrating, hydratedResult, resetProject };
};

// Owns all wizard state + derived values + actions, so the Builder component is render-only.
const useBuilderController = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [model, setModel] = useState<WizardModel>(EMPTY_MODEL);
  const { isProcessing, progress, processedVideo, error, processVideo, cancelProcessing, isFFmpegReady } =
    useVideoProcessing();
  const steps: WizardStep[] = selectedTemplate ? buildSteps(selectedTemplate) : [{ kind: 'template' }];
  const stepIndex = Math.min(model.stepIndex, steps.length - 1);
  const currentStepKind = steps[stepIndex]?.kind;
  const clipCount = selectedTemplate ? totalClips(selectedTemplate) : 0;
  const builderState: BuilderState = { ...model, selectedTemplate };
  const allComplete = allInputsComplete(steps, builderState);

  const { hydrating, hydratedResult, resetProject } = useProjectPersistence({
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
    onReset: () => {
      actions.handlers.onReset();
      resetProject();
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
  };

  return { isFFmpegReady, hydrating, flowProps };
};

export const Builder = () => {
  const { t } = useTranslation('builder');
  const { loadingProgress } = useFFmpeg();
  const { isFFmpegReady, hydrating, flowProps } = useBuilderController();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden">
      <h1 className="sr-only">{t('srHeading')}</h1>
      <Seo
        title={t('builder.title', { ns: 'seo' })}
        description={t('builder.description', { ns: 'seo' })}
        path="/builder"
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/15 rounded-full blur-[120px] animate-float" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-400/10 rounded-full blur-[120px] animate-float"
          style={{ animationDelay: '-3s' }}
        />
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-24 relative z-10">
        {hydrating ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-gray-400 fade-in">
            <Loader2 className="h-7 w-7 animate-spin text-brand-500 motion-reduce:animate-none" />
            <p className="text-sm font-medium">{t('project.loading')}</p>
          </div>
        ) : (
          <>
            {!flowProps.selectedTemplate && <BrowserCompatibility />}
            <HubFlow {...flowProps} />
          </>
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
