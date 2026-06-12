import { useState, useRef, useOptimistic, startTransition } from 'react';
import {
  coreCompilationService,
  type CompilationConfig,
  type MediaChoices,
} from '@/application/usecases/coreCompilationService';
import { type Template } from '@/services/templateService';
import { type VideoEdit } from '@/domain/valueObjects/videoEdits';
import { logger } from '@/lib/logger';
import { haptic } from '@/lib/haptics';

export type { MediaChoices };

interface ProcessingProgress {
  stage: string;
  percentage: number;
  currentStep: string;
  totalSteps: number;
  currentStepIndex: number;
  estimatedTimeRemaining?: number;
}

interface ProcessingState {
  isProcessing: boolean;
  progress: ProcessingProgress;
  processedVideo: ProcessedVideo | null;
  error: string | null;
}

export interface ProcessedVideo {
  blob: Blob;
  url: string;
  size: number;
  duration?: number;
}

const initialProgress: ProcessingProgress = {
  stage: '',
  percentage: 0,
  currentStep: '',
  totalSteps: 0,
  currentStepIndex: 0,
};

const initialState: ProcessingState = {
  isProcessing: false,
  progress: initialProgress,
  processedVideo: null,
  error: null,
};

type SetState = React.Dispatch<React.SetStateAction<ProcessingState>>;
type SetOptimistic = (update: Partial<ProcessingState>) => void;

function computeEstimatedTimeRemaining(elapsed: number, percentage: number): number | undefined {
  return percentage > 0 ? Math.round((elapsed / percentage) * (100 - percentage)) : undefined;
}

function buildCompilationConfig(
  files: File[],
  templateWithFormData: Template & { formData?: Record<string, string> },
  videoEdits?: Record<number, VideoEdit | undefined>,
  mediaChoices?: MediaChoices
): CompilationConfig {
  const { formData, ...template } = templateWithFormData;

  return { template, formData: formData ?? {}, files, videoEdits, mediaChoices };
}

function applyProgressUpdate(
  update: Partial<ProcessingProgress>,
  currentProgress: ProcessingProgress,
  elapsed: number,
  setState: SetState,
  setOptimisticState: SetOptimistic
) {
  const percentage = update.percentage ?? currentProgress.percentage;
  const progressUpdate: Partial<ProcessingProgress> = {
    ...update,
    estimatedTimeRemaining: computeEstimatedTimeRemaining(elapsed, percentage),
  };

  startTransition(() => {
    setOptimisticState({ progress: { ...currentProgress, ...progressUpdate } });
  });
  setState((prev) => ({ ...prev, progress: { ...prev.progress, ...progressUpdate } }));
}

function handleProcessingError(
  error: unknown,
  currentOptimisticProgress: ProcessingProgress,
  setState: SetState,
  setOptimisticState: SetOptimistic
) {
  logger.error('Video compilation error:', error);
  haptic('error');
  const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during video compilation';
  setState((prev) => ({
    ...prev,
    error: errorMessage,
    isProcessing: false,
    progress: { ...prev.progress, stage: 'Error' },
  }));
  startTransition(() => {
    setOptimisticState({
      isProcessing: false,
      error: errorMessage,
      progress: { ...currentOptimisticProgress, stage: 'Error' },
    });
  });
}

export const useVideoProcessing = () => {
  const [state, setState] = useState<ProcessingState>(initialState);

  const [optimisticState, setOptimisticState] = useOptimistic(
    state,
    (currentState, optimisticUpdate: Partial<ProcessingState>) => ({
      ...currentState,
      ...optimisticUpdate,
      progress: { ...currentState.progress, ...optimisticUpdate.progress },
    })
  );

  const abortController = useRef<AbortController | null>(null);
  const startTime = useRef<number>(0);

  const updateProgress = (update: Partial<ProcessingProgress>) => {
    applyProgressUpdate(update, optimisticState.progress, Date.now() - startTime.current, setState, setOptimisticState);
  };

  const processVideo = async (
    files: File[],
    templateWithFormData: Template & { formData?: Record<string, string> },
    videoEdits?: Record<number, VideoEdit | undefined>,
    mediaChoices?: MediaChoices
  ) => {
    // Only `project_video` sections consume an uploaded clip — color/text-only templates
    // (e.g. the premium title/quote cards) render with no upload at all.
    const requiresUpload = (templateWithFormData.descriptor.sections ?? []).some((s) => s.type === 'project_video');

    if (files.length === 0 && requiresUpload) {
      setState((prev) => ({ ...prev, error: 'Please select at least one video file.' }));

      return;
    }

    const compilationConfig = buildCompilationConfig(files, templateWithFormData, videoEdits, mediaChoices);

    startTransition(() => {
      setOptimisticState({
        isProcessing: true,
        progress: {
          stage: 'Initializing',
          percentage: 0,
          currentStep: 'Preparing',
          totalSteps: 6,
          currentStepIndex: 0,
        },
      });
    });

    setState((prev) => ({ ...prev, isProcessing: true, error: null, processedVideo: null }));
    abortController.current = new AbortController();
    startTime.current = Date.now();

    try {
      const result = await coreCompilationService.compileVideo(compilationConfig, updateProgress);
      setState((prev) => ({ ...prev, processedVideo: result, isProcessing: false }));
      haptic('success');
    } catch (error) {
      handleProcessingError(error, optimisticState.progress, setState, setOptimisticState);
    } finally {
      abortController.current = null;
    }
  };

  const cancelProcessing = () => {
    if (abortController.current) {
      abortController.current.abort();
      startTransition(() => {
        setOptimisticState({ isProcessing: false, error: 'Processing was cancelled by user' });
      });
      setState((prev) => ({ ...prev, isProcessing: false, error: 'Processing was cancelled by user' }));
    }
  };

  const clearResults = () => {
    if (optimisticState.processedVideo) {
      URL.revokeObjectURL(optimisticState.processedVideo.url);
    }
    const clearedState = { processedVideo: null, error: null, progress: initialProgress };
    startTransition(() => {
      setOptimisticState(clearedState);
    });
    setState((prev) => ({ ...prev, ...clearedState }));
  };

  return {
    isProcessing: optimisticState.isProcessing,
    // Progress is real streamed data (not an optimistic guess), so read it from
    // the canonical state — this guarantees a re-render/repaint on every update
    // instead of relying on the transient optimistic layer.
    progress: state.progress,
    processedVideo: optimisticState.processedVideo,
    error: optimisticState.error,
    processVideo,
    cancelProcessing,
    clearResults,
    isFFmpegReady: true, // Core compilation service handles all initialization internally
  };
};
