import { useMutation } from '@tanstack/react-query';
import { type CompileRecordedVideos } from '@/src/services/api';
import { compileOnDevice } from '@/src/services/compile/compileOnDevice';
import { useCompileProgressStore } from '@/src/stores/useCompileProgressStore';
import type { MediaChoices } from '@/src/types';

/**
 * Compile a video on-device, right now. The app is fully local — nothing is ever queued or sent to a
 * server. Drives the global CompileProgressOverlay from the engine's live `compilation-progress`
 * events and lets the overlay's Cancel button abort the in-flight render cooperatively. Resolves with
 * the raw result plus whether the user cancelled — the render can finish inside the abort window, so
 * callers must check `cancelled` before treating a success as one.
 */
export const useOnDeviceCompilation = () => {
  return useMutation({
    mutationFn: async ({
      templateDescriptor,
      recordedVideos,
      mediaChoices,
    }: {
      projectId: string;
      templateDescriptor: unknown;
      recordedVideos: CompileRecordedVideos;
      mediaChoices?: MediaChoices;
    }) => {
      const controller = new AbortController();
      const progress = useCompileProgressStore.getState();
      progress.start(() => {
        controller.abort();
      });

      try {
        const result = await compileOnDevice(templateDescriptor, recordedVideos, {
          mediaChoices,
          signal: controller.signal,
          onProgress: ({ ratio, stage }) => {
            useCompileProgressStore.getState().update(ratio, stage);
          },
        });

        return { result, cancelled: controller.signal.aborted };
      } finally {
        progress.finish();
      }
    },
  });
};
