import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { TemplateSelector } from '@/presentation/components/TemplateSelector';
import { VideoProcessor } from '@/presentation/components/VideoProcessor';
import { ProgressDisplay } from '@/presentation/components/ProgressDisplay';
import { ExportPanel } from '@/presentation/components/ExportPanel';
import { BrowserCompatibility } from '@/presentation/components/BrowserCompatibility';
import { Seo } from '@/presentation/components/Seo';
import { Stepper } from '@/presentation/components/ui/Stepper';
import { StepForm, StepClip, StepMedia, SectionHub } from '@/presentation/components/builder';
import { useVideoProcessing, type ProcessedVideo, type MediaChoices } from '@/hooks/useVideoProcessing';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { templateService, type Template, type InputSection } from '@/services/templateService';
import { type VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { MediaChoice } from '@/presentation/components/admin/templateEditorModel';
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

// Short label for the stepper. Clips are numbered; forms read "Details".
const stepLabel = (step: WizardStep, clipCount: number, t: TFunction<'builder'>): string => {
  if (step.kind === 'template') {
    return t('steps.template');
  }

  if (step.kind === 'form') {
    return t('steps.details');
  }

  if (step.kind === 'clip') {
    return clipCount > 1 ? t('steps.clip', { number: step.clipIndex + 1 }) : t('steps.yourClip');
  }

  if (step.kind === 'media') {
    return t('steps.music');
  }

  if (step.kind === 'process') {
    return t('steps.create');
  }

  return t('steps.done');
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
}: StepProcessProps) => {
  const { t } = useTranslation('builder');

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
            error={error}
            template={selectedTemplate}
            formData={formData}
            uploadedFiles={clipFiles}
          />
        </Card>
      </div>
      {isProcessing && (
        <Card
          elevation="flat"
          className="mt-8 glass-panel-dark p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <h3 className="text-xl font-semibold mb-4 font-display text-foreground">{t('stepProcess.progress')}</h3>
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
  onResultBack: () => void;
  onReset: () => void;
}

// Renders the active step. Early-returns keep each branch single-condition (template handled first,
// then a null-template guard so the rest don't re-check it).
const StepContent = (p: StepContentProps) => {
  const { step, selectedTemplate, model } = p;

  if (step.kind === 'template') {
    return <StepTemplate selectedTemplate={selectedTemplate} onTemplateSelected={p.onTemplateSelected} />;
  }

  if (!selectedTemplate) return null;

  if (step.kind === 'form') {
    return (
      <StepForm
        template={selectedTemplate}
        section={{ name: step.section.name, title: step.section.title }}
        formData={model.formData}
        onFormDataChange={p.onFormDataChange}
      />
    );
  }

  if (step.kind === 'clip') {
    const section = (selectedTemplate.descriptor.sections ?? []).find((sec) => sec.name === step.sectionName);

    if (!section) return null;

    return (
      <StepClip
        section={section}
        clipNumber={step.clipIndex + 1}
        totalClips={p.clipCount}
        file={model.clipsBySection[step.sectionName]}
        onFileChange={(file) => {
          p.onClipChange(step.sectionName, file);
        }}
        edit={model.editsBySection[step.sectionName]}
        onEditChange={(edit) => {
          p.onEditChange(step.sectionName, edit);
        }}
      />
    );
  }

  if (step.kind === 'media') {
    return (
      <StepMedia
        selectedTemplate={selectedTemplate}
        musicChoice={model.musicChoice}
        backgroundChoice={model.backgroundChoice}
        onMusicChange={p.onMusicChange}
        onBackgroundChange={p.onBackgroundChange}
      />
    );
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
      />
    );
  }

  if (p.processedVideo) {
    return <StepResult processedVideo={p.processedVideo} onBack={p.onResultBack} onReset={p.onReset} />;
  }

  return null;
};

// All wizard inputs in one state object so the Builder component stays small. `selectedTemplate` is
// separate — picking one resets the model.
interface WizardModel {
  clipsBySection: Record<string, File>;
  editsBySection: Record<string, VideoEdit | undefined>;
  formData: Record<string, string>;
  musicChoice: MediaChoice | null;
  backgroundChoice: MediaChoice | null;
  stepIndex: number;
}

type ProcessProgress = ReturnType<typeof useVideoProcessing>['progress'];

const EMPTY_MODEL: WizardModel = {
  clipsBySection: {},
  editsBySection: {},
  formData: {},
  musicChoice: null,
  backgroundChoice: null,
  stepIndex: 0,
};

// ── Wizard mode (linear vs hub) ──────────────────────────────────────────────────────────────────
// 'linear' = the existing Stepper-driven, one-step-at-a-time flow. 'hub' = a single SectionHub page.
// Both share the same WizardModel state, so switching never loses input. The choice is persisted.
type WizardMode = 'linear' | 'hub';
const MODE_STORAGE_KEY = 'leclap-builder-mode';

const readStoredMode = (): WizardMode => {
  try {
    return globalThis.localStorage.getItem(MODE_STORAGE_KEY) === 'hub' ? 'hub' : 'linear';
  } catch {
    return 'linear';
  }
};

const writeStoredMode = (mode: WizardMode): void => {
  try {
    globalThis.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable (private mode / disabled cookies); the choice just won't persist.
  }
};

// Read once on mount, write back whenever the mode changes.
const useWizardMode = (): [WizardMode, (m: WizardMode) => void] => {
  const [mode, setMode] = useState<WizardMode>(readStoredMode);

  useEffect(() => {
    writeStoredMode(mode);
  }, [mode]);

  return [mode, setMode];
};

const MODE_OPTIONS = ['linear', 'hub'] as const;

// Segmented control shown in the Builder header once a template is chosen.
const ModeToggle = ({ mode, onChange }: { mode: WizardMode; onChange: (m: WizardMode) => void }) => {
  const { t } = useTranslation('builder');

  return (
    <div
      role="radiogroup"
      aria-label={t('modeToggle.ariaLabel')}
      className="inline-flex items-center gap-1 rounded-full bg-foreground/5 p-1 ring-1 ring-foreground/10"
    >
      {MODE_OPTIONS.map((value) => {
        const active = mode === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              onChange(value);
            }}
            className={cn(
              'min-h-[2.5rem] rounded-full px-4 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
              active ? 'brand-gradient text-white shadow-sm shadow-brand-500/20' : 'text-gray-400 hover:text-foreground'
            )}
          >
            {t(`modeToggle.${value}`)}
          </button>
        );
      })}
    </div>
  );
};

// Callbacks shared by both flows — bundled so the flow components take one prop instead of a dozen.
interface WizardHandlers {
  onTemplateSelected: (t: Template) => void;
  onFormDataChange: (d: Record<string, string>) => void;
  onClipChange: (sectionName: string, file: File | undefined) => void;
  onEditChange: (sectionName: string, edit: VideoEdit | undefined) => void;
  onMusicChange: (c: MediaChoice | null) => void;
  onBackgroundChange: (c: MediaChoice | null) => void;
  onStartProcessing: () => void;
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

// The existing Stepper-driven, one-step-at-a-time flow. Unchanged behaviour, lifted into its own
// component so the Builder body can swap it for the hub.
const LinearFlow = (p: FlowProps) => {
  const { t } = useTranslation('builder');
  const { selectedTemplate, model, steps, stepIndex, clipCount, builderState, handlers } = p;
  const step = steps[stepIndex];

  return (
    <>
      <div className="max-w-4xl mx-auto mb-12">
        <Stepper
          steps={steps.map((s) => stepLabel(s, clipCount, t))}
          currentStep={stepIndex}
          onStepClick={(index) => {
            const reachable = index <= stepIndex || allInputsComplete(steps.slice(0, index + 1), builderState);

            if (reachable) p.goTo(index);
          }}
        />
      </div>
      <div className="max-w-6xl mx-auto">
        <StepContent
          step={step}
          selectedTemplate={selectedTemplate}
          model={model}
          clipCount={clipCount}
          processedVideo={p.processedVideo}
          processing={p.processing}
          onTemplateSelected={handlers.onTemplateSelected}
          onFormDataChange={handlers.onFormDataChange}
          onClipChange={handlers.onClipChange}
          onEditChange={handlers.onEditChange}
          onMusicChange={handlers.onMusicChange}
          onBackgroundChange={handlers.onBackgroundChange}
          onStartProcessing={handlers.onStartProcessing}
          onResultBack={handlers.onResultBack}
          onReset={handlers.onReset}
        />
        <div className="flex justify-between mt-16 pt-8 border-t border-foreground/10">
          <Button
            variant="ghost"
            onClick={p.prevStep}
            disabled={stepIndex === 0 || step.kind === 'result'}
            className="group px-6 py-3"
          >
            <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-1" />
            {t('actions.back', { ns: 'common' })}
          </Button>
          {step.kind !== 'process' && step.kind !== 'result' && (
            <Button
              variant="primary"
              onClick={p.nextStep}
              disabled={!isStepComplete(step, builderState)}
              className="group px-8 py-3 active:translate-y-0 active:scale-[0.98]"
            >
              {t('actions.next', { ns: 'common' })}
              <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

// Index of the process / result steps, used by the hub to reuse the linear screens for those phases.
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

// Owns all wizard state + derived values + actions, so the Builder component is render-only.
const useBuilderController = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [model, setModel] = useState<WizardModel>(EMPTY_MODEL);
  const { isProcessing, progress, processedVideo, error, processVideo, isFFmpegReady } = useVideoProcessing();
  const steps: WizardStep[] = selectedTemplate ? buildSteps(selectedTemplate) : [{ kind: 'template' }];
  const stepIndex = Math.min(model.stepIndex, steps.length - 1);
  const clipCount = selectedTemplate ? totalClips(selectedTemplate) : 0;
  const builderState: BuilderState = { ...model, selectedTemplate };
  const allComplete = allInputsComplete(steps, builderState);
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
  });
  const flowProps: FlowProps = {
    selectedTemplate,
    model,
    steps,
    stepIndex,
    clipCount,
    builderState,
    allComplete,
    processedVideo,
    processing: {
      isFFmpegReady,
      isProcessing,
      canProcess: Boolean(selectedTemplate) && isFFmpegReady && allComplete,
      progress,
      error,
    },
    handlers: actions.handlers,
    goTo: actions.goTo,
    nextStep: actions.nextStep,
    prevStep: actions.prevStep,
  };

  return { selectedTemplate, step: steps[stepIndex], isFFmpegReady, flowProps, nextStep: actions.nextStep };
};

export const Builder = () => {
  const { t } = useTranslation('builder');
  const { loadingProgress } = useFFmpeg();
  const [wizardMode, setWizardMode] = useWizardMode();
  const { selectedTemplate, step, isFFmpegReady, flowProps, nextStep } = useBuilderController();

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
        <BrowserCompatibility />
        {selectedTemplate && (
          <div className="mb-10 flex justify-center">
            <ModeToggle mode={wizardMode} onChange={setWizardMode} />
          </div>
        )}
        {wizardMode === 'linear' && <LinearFlow {...flowProps} />}
        {wizardMode === 'hub' && <HubFlow {...flowProps} />}
        {step.kind === 'template' && selectedTemplate && wizardMode === 'linear' && (
          <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 pointer-events-none">
            <Card
              elevation="flat"
              className="slide-up pointer-events-auto flex items-center gap-3 rounded-full bg-surface/90 backdrop-blur-md py-2 pl-5 pr-2 shadow-xl shadow-brand-500/10"
            >
              <span className="hidden sm:inline text-sm text-gray-400">{t('chip.template')}</span>
              <span className="max-w-[10rem] truncate text-sm font-semibold text-foreground">
                {selectedTemplate.name}
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={nextStep}
                className="group rounded-full px-5 py-2.5 shadow-brand-500/25 [&_svg]:size-4"
              >
                {t('actions.continue', { ns: 'common' })}{' '}
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Card>
          </div>
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
