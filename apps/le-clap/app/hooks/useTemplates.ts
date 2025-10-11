import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTemplates, fetchTemplateByName } from '../services/api';
import { Template } from '../types';

export const useTemplates = () => {
  return useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useTemplate = (templateName: string) => {
  return useQuery({
    queryKey: ['template', templateName],
    queryFn: () => fetchTemplateByName(templateName),
    enabled: !!templateName,
  });
};
