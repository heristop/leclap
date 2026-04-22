import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectAdapter } from '@/src/presentation/adapters/ProjectAdapter';
import { ProjectMapper } from '@/src/presentation/mappers/ProjectMapper';
import type { Project } from '@/src/types';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const domainProjects = await projectAdapter.getAllProjects();
      return ProjectMapper.toUIArray(domainProjects);
    },
  });
};

export const useProject = (projectId: string) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const domainProject = await projectAdapter.getProjectById(projectId);
      return domainProject ? ProjectMapper.toUI(domainProject) : null;
    },
    enabled: !!projectId,
  });
};

export const useSaveProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (project: Project) => {
      const existingProject = project.id ? await projectAdapter.getProjectById(project.id) : null;

      if (!existingProject) {
        const domainProject = await projectAdapter.createProject({
          id: project.id,
          name: project.name,
          templateName: project.templateName,
          templateContent: project.templateContent as Record<string, unknown>,
          formData: project.formData,
          recordedVideos: project.recordedVideos,
          outputVideoUri: project.outputVideoUri,
          thumbnailUri: project.thumbnailUri ?? undefined,
          createdAt: project.createdAt ? new Date(project.createdAt) : undefined,
          updatedAt: project.updatedAt ? new Date(project.updatedAt) : undefined,
        });

        return ProjectMapper.toUI(domainProject);
      }

      const updateData = {
        id: project.id,
        name: project.name,
        templateContent: project.templateContent,
        formData: project.formData,
        recordedVideos: project.recordedVideos,
        outputVideoUri: project.outputVideoUri,
        thumbnailUri: project.thumbnailUri,
      };

      const domainProject = await projectAdapter.updateProject(updateData);
      return ProjectMapper.toUI(domainProject);
    },
    onSuccess: (data) => {
      // Invalidate both the projects list and the specific project
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => projectAdapter.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useDeleteAllProjects = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => projectAdapter.deleteAllProjects(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
