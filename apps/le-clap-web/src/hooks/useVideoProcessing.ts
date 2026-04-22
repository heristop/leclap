import { useState, useCallback, useRef, useOptimistic, startTransition } from 'react';
import { coreCompilationService, type CompilationConfig } from '../services/coreCompilationService';
import { type Template } from '../services/templateService';
import { logger } from '../lib/logger';

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

export const useVideoProcessing = () => {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: {
      stage: '',
      percentage: 0,
      currentStep: '',
      totalSteps: 0,
      currentStepIndex: 0,
    },
    processedVideo: null,
    error: null,
  });

  const [optimisticState, setOptimisticState] = useOptimistic(
    state,
    (currentState, optimisticUpdate: Partial<ProcessingState>) => ({
      ...currentState,
      ...optimisticUpdate,
      progress: {
        ...currentState.progress,
        ...optimisticUpdate.progress,
      },
    })
  );

  const abortController = useRef<AbortController | null>(null);
  const startTime = useRef<number>(0);

  const updateProgress = useCallback(
    (update: Partial<ProcessingProgress>) => {
      const now = Date.now();
      const elapsed = now - startTime.current;
      const progress = update.percentage || optimisticState.progress.percentage;

      // Estimate time remaining based on current progress
      const estimatedTimeRemaining = progress > 0 ? Math.round((elapsed / progress) * (100 - progress)) : undefined;

      const progressUpdate: Partial<ProcessingProgress> = {
        ...update,
        estimatedTimeRemaining,
      };

      // Use optimistic update for immediate UI feedback
      startTransition(() => {
        setOptimisticState({
          progress: {
            ...optimisticState.progress,
            ...progressUpdate,
          },
        });
      });

      // Update actual state
      setState((prev) => ({
        ...prev,
        progress: { ...prev.progress, ...progressUpdate },
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optimisticState.progress.percentage]
    // setOptimisticState is stable (from useOptimistic) and doesn't need to be in deps
  );

  const processVideo = useCallback(
    async (files: File[], templateWithFormData: Template & { formData?: Record<string, string> }) => {
      if (files.length === 0) {
        setState((prev) => ({
          ...prev,
          error: 'Please select at least one video file.',
        }));
        return;
      }

      // Extract template and form data
      const { formData, ...template } = templateWithFormData;
      const compilationConfig: CompilationConfig = {
        template,
        formData: formData || {},
        files,
      };

      // Optimistically start processing
      startTransition(() => {
        setOptimisticState({
          isProcessing: true,
          progress: {
            stage: 'Initializing',
            percentage: 0,
            currentStep: 'Preparing to process video with real template',
            totalSteps: 6,
            currentStepIndex: 0,
          },
        });
      });

      setState((prev) => ({
        ...prev,
        isProcessing: true,
        error: null,
        processedVideo: null,
      }));

      abortController.current = new AbortController();
      startTime.current = Date.now();

      try {
        // Use the core compilation service
        const result = await coreCompilationService.compileVideo(compilationConfig, (progress) => {
          updateProgress(progress);
        });

        // Update actual state with real result
        setState((prev) => ({
          ...prev,
          processedVideo: result,
          isProcessing: false,
        }));
      } catch (err) {
        logger.error('Video compilation error:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during video compilation';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isProcessing: false,
          progress: { ...prev.progress, stage: 'Error' }
        }));

        // Also update optimistic state to ensure UI reflects error immediately
        startTransition(() => {
          setOptimisticState({
            isProcessing: false,
            error: errorMessage,
            progress: { ...optimisticState.progress, stage: 'Error' }
          });
        });
      } finally {
        abortController.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateProgress]
    // setOptimisticState is stable (from useOptimistic) and doesn't need to be in deps
  );

  const cancelProcessing = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();

      // Optimistic cancellation
      startTransition(() => {
        setOptimisticState({
          isProcessing: false,
          error: 'Processing was cancelled by user',
        });
      });

      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: 'Processing was cancelled by user',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setOptimisticState is stable (from useOptimistic) and doesn't need to be in deps

  const clearResults = useCallback(() => {
    if (optimisticState.processedVideo) {
      URL.revokeObjectURL(optimisticState.processedVideo.url);
    }

    const clearedState = {
      processedVideo: null,
      error: null,
      progress: {
        stage: '',
        percentage: 0,
        currentStep: '',
        totalSteps: 0,
        currentStepIndex: 0,
      },
    };

    // Optimistic clear
    startTransition(() => {
      setOptimisticState(clearedState);
    });

    setState((prev) => ({ ...prev, ...clearedState }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimisticState.processedVideo]); // setOptimisticState is stable (from useOptimistic) and doesn't need to be in deps

  return {
    isProcessing: optimisticState.isProcessing,
    progress: optimisticState.progress,
    processedVideo: optimisticState.processedVideo,
    error: optimisticState.error,
    processVideo,
    cancelProcessing,
    clearResults,
    isFFmpegReady: true, // Core compilation service handles all initialization internally
  };
};
