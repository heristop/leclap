import { useMutation } from '@tanstack/react-query';
import { type CompileRecordedVideos } from '@/src/services/api';
import { compileOnDevice } from '@/src/services/compile/compileOnDevice';
import { useCompileProgressStore } from '@/src/stores/useCompileProgressStore';
import type { TemplateDescriptor } from '@/src/types';

export const useVideoCompilation = () => {
  return useMutation({
    mutationFn: async ({
      templateDescriptor,
      recordedVideos,
    }: {
      templateDescriptor: TemplateDescriptor;
      recordedVideos: CompileRecordedVideos;
    }) => {
      // Drive the global CompileProgressOverlay from the engine's live progress events.
      const progress = useCompileProgressStore.getState();
      progress.start();

      try {
        return await compileOnDevice(templateDescriptor, recordedVideos, {
          onProgress: ({ ratio, stage }) => {
            useCompileProgressStore.getState().update(ratio, stage);
          },
        });
      } finally {
        progress.finish();
      }
    },
  });
};
