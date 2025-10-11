import { useMutation } from '@tanstack/react-query';
import { compileVideo } from '../services/api';

export const useVideoCompilation = () => {
  return useMutation({
    mutationFn: ({
      templateDescriptor,
      recordedVideos,
    }: {
      templateDescriptor: any;
      recordedVideos: Record<string, { path: string; orientation: 'portrait' | 'landscape' }>;
    }) => compileVideo(templateDescriptor, recordedVideos),
  });
};
