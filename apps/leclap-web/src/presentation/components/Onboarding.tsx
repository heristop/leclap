import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CameraCapture } from '@/presentation/components/CameraCapture';
import { WelcomeStep, CreateStep, CompilingStep, DoneStep, ErrorStep } from '@/presentation/components/OnboardingSteps';
import { templateService, type Template } from '@/services/templateService';
import { recordingConfigFromDescriptor } from '@/lib/recordingConfig';
import {
  coreCompilationService,
  type CompilationProgress,
  type CompilationResult,
} from '@/application/usecases/coreCompilationService';
import { logger } from '@/lib/logger';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';

type Step = 'welcome' | 'create' | 'compiling' | 'done' | 'error';

// The onboarding makes a first video from a built-in template so newcomers see the whole flow
// (record → compile → download) in one guided pass. We match the template to the device: a portrait
// reel on phones held upright, the landscape Premium Spotlight otherwise — so the recorded clip
// fills the frame instead of being letter-boxed. Both wrap the clip in a cinematic intro + outro
// and grade it; the name typed at the record step lands in the first form field (the title card).
const LANDSCAPE_TEMPLATE_ID = 'premium-spotlight';
const PORTRAIT_TEMPLATE_ID = 'premium-reel-portrait';

const pickSampleTemplateId = (): string =>
  window.matchMedia('(orientation: portrait)').matches ? PORTRAIT_TEMPLATE_ID : LANDSCAPE_TEMPLATE_ID;

const initialProgress: CompilationProgress = {
  stage: 'Starting',
  percentage: 0,
  currentStep: 'Preparing your intro',
  totalSteps: 7,
  currentStepIndex: 0,
};

interface OnboardingProps {
  onDone: () => void;
}

export const Onboarding = ({ onDone }: OnboardingProps) => {
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  // Chosen once when the modal opens so a mid-flow rotation can't swap the template underfoot.
  const [sampleTemplateId] = useState(pickSampleTemplateId);
  const [template, setTemplate] = useState<Template | null>(null);
  const [progress, setProgress] = useState<CompilationProgress>(initialProgress);
  const [result, setResult] = useState<CompilationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useLockBodyScroll();

  // Load the sample template up front so the camera can read its countdown/duration config.
  useEffect(() => {
    templateService
      .getTemplate(sampleTemplateId)
      .then(setTemplate)
      .catch((error: unknown) => {
        logger.error('Onboarding template preload failed:', error);
      });
  }, [sampleTemplateId]);

  const canCreate = name.trim().length > 0 && videoFile !== null;
  const recordingConfig = recordingConfigFromDescriptor(template?.descriptor);

  const handleCreate = async () => {
    if (!videoFile) return;

    setStep('compiling');
    setProgress(initialProgress);

    try {
      const sampleTemplate = template ?? (await templateService.getTemplate(sampleTemplateId));

      if (!sampleTemplate) throw new Error(`Sample template "${sampleTemplateId}" could not be loaded.`);

      // Put the entered name in the first text field; leave the rest blank.
      const fields = templateService.extractFormFields(sampleTemplate.descriptor);
      const formData: Record<string, string> = {};

      for (const [index, field] of fields.entries()) {
        formData[field.name] = index === 0 ? name.trim() : '';
      }

      const compiled = await coreCompilationService.compileVideo(
        { template: sampleTemplate, formData, files: [videoFile] },
        setProgress
      );
      setResult(compiled);
      setStep('done');
    } catch (error) {
      logger.error('Onboarding compilation failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong while creating your video.');
      setStep('error');
    }
  };

  const onFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) setVideoFile(file);
  };

  return createPortal(
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-black/40 dark:bg-black/80">
      {/* Ambient brand aurora — drifting multi-color blobs for a first-run "wow" backdrop.
          Hidden on mobile, where the soft glow reads as an unwanted blur on the small modal. */}
      <div className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] bg-brand-500/20 rounded-full blur-[120px] animate-float" />
        <div
          className="absolute top-1/4 -left-24 w-[26rem] h-[26rem] bg-secondary-500/15 rounded-full blur-[110px] animate-float"
          style={{ animationDelay: '-4s' }}
        />
        <div
          className="absolute -bottom-24 right-0 w-[28rem] h-[28rem] bg-accent-400/10 rounded-full blur-[120px] animate-float"
          style={{ animationDelay: '-8s' }}
        />
      </div>

      <div className="relative min-h-full flex items-center justify-center p-4 pt-[max(1.5rem,env(safe-area-inset-top))] safe-b">
        <div className="relative w-full max-w-lg bg-surface border border-foreground/10 rounded-2xl p-6 sm:p-8 shadow-2xl rise-in">
          {(step === 'welcome' || step === 'create') && (
            <button
              onClick={onDone}
              className="tap absolute top-4 right-4 grid place-items-center w-10 h-10 rounded-full text-gray-400 hover:text-foreground hover:bg-foreground/10 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 before:absolute before:-inset-1.5 before:content-['']"
              aria-label="Skip onboarding"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Keyed wrapper so each step re-triggers the entrance animation,
              keeping transitions between steps smooth and on-brand. */}
          <div key={step} className="fade-in">
            {step === 'welcome' && (
              <WelcomeStep
                onStart={() => {
                  setStep('create');
                }}
                onDone={onDone}
              />
            )}

            {step === 'create' && (
              <CreateStep
                name={name}
                onNameChange={setName}
                videoFile={videoFile}
                canCreate={canCreate}
                fileInputRef={fileInputRef}
                onOpenCamera={() => {
                  setShowCamera(true);
                }}
                onFilePicked={onFilePicked}
                onCreate={() => {
                  handleCreate().catch((error: unknown) => {
                    logger.error('Onboarding create handler failed:', error);
                  });
                }}
              />
            )}

            {step === 'compiling' && <CompilingStep progress={progress} />}

            {step === 'done' && result && <DoneStep result={result} onDone={onDone} />}

            {step === 'error' && (
              <ErrorStep
                errorMessage={errorMessage}
                onRetry={() => {
                  setStep('create');
                }}
                onDone={onDone}
              />
            )}
          </div>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={(file) => {
            setVideoFile(file);
          }}
          onClose={() => {
            setShowCamera(false);
          }}
          countdownSeconds={recordingConfig.countdownSeconds}
          maxDurationSeconds={recordingConfig.maxDurationSeconds}
        />
      )}
    </div>,
    document.body
  );
};
