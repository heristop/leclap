import { useMutation } from '@tanstack/react-query';
import { compileVideo, type CompileRecordedVideos } from '@/src/services/api';
import type { TemplateDescriptor } from '@/src/types';

export const useVideoCompilation = () => {
  return useMutation({
    mutationFn: ({
      templateDescriptor,
      recordedVideos,
    }: {
      templateDescriptor: TemplateDescriptor;
      recordedVideos: CompileRecordedVideos;
    }) => compileVideo(templateDescriptor, recordedVideos),
  });
};
