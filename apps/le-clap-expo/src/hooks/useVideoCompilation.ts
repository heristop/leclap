import { useMutation } from '@tanstack/react-query';
import { compileVideo } from '@/src/services/api';
import type { TemplateDescriptor } from '@/src/types';

export const useVideoCompilation = () => {
  return useMutation({
    mutationFn: ({
      templateDescriptor,
      recordedVideos,
    }: {
      templateDescriptor: TemplateDescriptor;
      recordedVideos: Record<string, { path: string; orientation: 'portrait' | 'landscape' }>;
    }) => compileVideo(templateDescriptor, recordedVideos),
  });
};
