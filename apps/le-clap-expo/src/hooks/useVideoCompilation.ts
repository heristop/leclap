import { useMutation } from '@tanstack/react-query';
import { type CompileRecordedVideos } from '@/src/services/api';
import { compileHybrid } from '@/src/services/compile/compileHybrid';
import type { TemplateDescriptor } from '@/src/types';

export const useVideoCompilation = () => {
  return useMutation({
    mutationFn: ({
      templateDescriptor,
      recordedVideos,
    }: {
      templateDescriptor: TemplateDescriptor;
      recordedVideos: CompileRecordedVideos;
    }) => compileHybrid(templateDescriptor, recordedVideos),
  });
};
