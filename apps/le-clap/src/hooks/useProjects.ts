import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, getProjectById, saveProject, deleteProject, deleteAllProjects } from '@/src/services/api';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
};

export const useProject = (projectId: string) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId),
    enabled: !!projectId,
  });
};

export const useSaveProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useDeleteAllProjects = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAllProjects,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
