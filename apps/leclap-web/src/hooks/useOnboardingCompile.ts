import { useRef, useState } from 'react';
import type { TemplateOrientation } from '@leclap/creative-kit';
import { templateService, type Template } from '@/services/templateService';
import {
  coreCompilationService,
  type CompilationProgress,
  type CompilationResult,
} from '@/application/usecases/coreCompilationService';
import { classifyCompileFailure, type CompileFailure } from '@/application/usecases/compile-failure';
import { logger } from '@/lib/logger';

export type OnboardingStep = 'welcome' | 'create' | 'compiling' | 'done' | 'error';

const initialProgress: CompilationProgress = {
  stage: 'Starting',
  percentage: 0,
  currentStep: 'Preparing your intro',
  totalSteps: 7,
  currentStepIndex: 0,
};

// The entered name goes in the sample's first text field; the rest stay blank.
const sampleFormData = (template: Template, name: string): Record<string, string> =>
  Object.fromEntries(
    templateService
      .extractFormFields(template.descriptor)
      .map((field, index) => [field.name, index === 0 ? name.trim() : ''])
  );

async function loadSampleClip(): Promise<File> {
  const response = await fetch('/videos/drink-and-coffee.mp4');

  if (!response.ok) throw new Error('Sample clip could not be loaded.');

  return new File([await response.blob()], 'sample.mp4', { type: 'video/mp4' });
}

// The onboarding compile flow: step state + a start/stop pair around the in-browser compile. `stop`
// cancels an in-flight compile (the engine halts at the next segment boundary) and closes via onClose.
// Each start gets a ticket that `stop` voids, so a stopped compile's late progress, result or failure
// never reaches the dialog.
export function useOnboardingCompile(opts: {
  sampleTemplateId: string;
  sampleFormat: TemplateOrientation;
  template: Template | null;
  onClose: () => void;
}) {
  const { sampleTemplateId, sampleFormat, template, onClose } = opts;
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [progress, setProgress] = useState<CompilationProgress>(initialProgress);
  const [result, setResult] = useState<CompilationResult | null>(null);
  const [failure, setFailure] = useState<CompileFailure | null>(null);
  const ticket = useRef(0);
  const sampleDemo = useRef(false);

  const start = async (name: string, videoFile: File | 'sample' | null) => {
    if (!videoFile) return;

    setStep('compiling');
    setProgress(initialProgress);
    ticket.current += 1;
    const run = ticket.current;

    try {
      const sampleTemplate = template ?? (await templateService.getTemplate(sampleTemplateId, sampleFormat));

      if (!sampleTemplate) throw new Error(`Sample template "${sampleTemplateId}" could not be loaded.`);

      const clip = videoFile === 'sample' ? await loadSampleClip() : videoFile;

      if (run !== ticket.current) return;

      const compiled = await coreCompilationService.compileVideo(
        { template: sampleTemplate, formData: sampleFormData(sampleTemplate, name), files: [clip] },
        (update) => {
          if (run === ticket.current) setProgress(update);
        }
      );

      if (run !== ticket.current) {
        URL.revokeObjectURL(compiled.url);

        return;
      }
      setResult(compiled);
      setStep('done');
    } catch (error) {
      // A stopped compile rejects too: swallow it, the dialog is already closing.
      if (run !== ticket.current) return;

      logger.error('Onboarding compilation failed:', error);
      setFailure(classifyCompileFailure(error));
      setStep('error');
    }
  };

  const stop = () => {
    ticket.current += 1;
    coreCompilationService.cancel();
    onClose();
  };

  const startSample = () => {
    sampleDemo.current = true;

    return start('LeClap', 'sample');
  };
  const retry = async () => {
    if (sampleDemo.current) {
      await startSample();

      return;
    }
    setStep('create');
  };

  return { step, setStep, progress, result, failure, start, startSample, retry, stop };
}
