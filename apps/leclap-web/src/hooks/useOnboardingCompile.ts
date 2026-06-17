import { useRef, useState } from 'react';
import { templateService, type Template } from '@/services/templateService';
import {
  coreCompilationService,
  type CompilationProgress,
  type CompilationResult,
} from '@/application/usecases/coreCompilationService';
import { logger } from '@/lib/logger';

export type OnboardingStep = 'welcome' | 'create' | 'compiling' | 'done' | 'error';

const initialProgress: CompilationProgress = {
  stage: 'Starting',
  percentage: 0,
  currentStep: 'Preparing your intro',
  totalSteps: 7,
  currentStepIndex: 0,
};

// The onboarding compile flow: step state + a start/stop pair around the in-browser compile. `stop`
// cancels an in-flight compile (the engine halts at the next segment boundary) and closes via onClose;
// the cancelled rejection is swallowed (wasCancelled) so it doesn't surface as the error step.
export function useOnboardingCompile(opts: {
  sampleTemplateId: string;
  template: Template | null;
  onClose: () => void;
}) {
  const { sampleTemplateId, template, onClose } = opts;
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [progress, setProgress] = useState<CompilationProgress>(initialProgress);
  const [result, setResult] = useState<CompilationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const cancelledRef = useRef(false);
  // Read through a closure so TS doesn't narrow it to `false` after the reset below.
  const wasCancelled = () => cancelledRef.current;

  const start = async (name: string, videoFile: File | null) => {
    if (!videoFile) return;

    setStep('compiling');
    setProgress(initialProgress);
    cancelledRef.current = false;

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
      // A user-initiated stop rejects the compile too — swallow it; the dialog is already closing.
      if (wasCancelled()) return;

      logger.error('Onboarding compilation failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong while creating your video.');
      setStep('error');
    }
  };

  const stop = () => {
    cancelledRef.current = true;
    coreCompilationService.cancel();
    onClose();
  };

  return { step, setStep, progress, result, errorMessage, start, stop };
}
