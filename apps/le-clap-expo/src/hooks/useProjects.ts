import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectAdapter } from '@/src/presentation/adapters/ProjectAdapter';
import { ProjectMapper } from '@/src/presentation/mappers/ProjectMapper';
import { VideoMetadata } from '@/src/domain/valueObjects/VideoMetadata';
import type { CreateProjectDTO } from '@/src/application/usecases/projects/CreateProject';
import type { UpdateProjectDTO } from '@/src/application/usecases/projects/UpdateProject';
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
    enabled: Boolean(projectId),
  });
};

export const useSaveProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (project: Project) => {
      const existingProject = project.id ? await projectAdapter.getProjectById(project.id) : null;

      if (!existingProject) {
        const createDTO: CreateProjectDTO = {
          id: project.id,
          name: project.name,
          templateName: project.templateName,
          templateContent: project.templateContent as Record<string, unknown>,
          formData: project.formData,
          recordedVideos: Object.fromEntries(
            Object.entries(project.recordedVideos).map(([key, value]) => [
              key,
              new VideoMetadata({
                path: value.path,
                orientation: value.orientation,
                duration: value.duration,
                trim: value.trim,
                crop: value.crop,
              }),
            ])
          ),
          outputVideoUri: project.outputVideoUri,
          thumbnailUri: project.thumbnailUri ?? undefined,
          createdAt: project.createdAt ? new Date(project.createdAt) : undefined,
          updatedAt: project.updatedAt ? new Date(project.updatedAt) : undefined,
        };
        const domainProject = await projectAdapter.createProject(
          createDTO as Parameters<typeof projectAdapter.createProject>[0]
        );

        return ProjectMapper.toUI(domainProject);
      }

      const updateData: UpdateProjectDTO = {
        id: project.id,
        name: project.name,
        templateContent: project.templateContent as Record<string, unknown>,
        formData: project.formData,
        recordedVideos: Object.fromEntries(
          Object.entries(project.recordedVideos).map(([key, value]) => [
            key,
            new VideoMetadata({ path: value.path, orientation: value.orientation, duration: value.duration }),
          ])
        ),
        outputVideoUri: project.outputVideoUri,
        thumbnailUri: project.thumbnailUri ?? undefined,
      };

      const domainProject = await projectAdapter.updateProject(
        updateData as Parameters<typeof projectAdapter.updateProject>[0]
      );

      return ProjectMapper.toUI(domainProject);
    },
    onSuccess: async (data) => {
      // Invalidate both the projects list and the specific project
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['project', data.id] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => projectAdapter.deleteProject(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useDeleteAllProjects = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => projectAdapter.deleteAllProjects(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
