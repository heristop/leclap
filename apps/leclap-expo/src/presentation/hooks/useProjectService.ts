import { projectAdapter } from '@/src/presentation/adapters/ProjectAdapter';
import { ProjectMapper } from '@/src/presentation/mappers/ProjectMapper';
import {
  useSetProjects,
  useSetLoading,
  useDeleteProject as useDeleteProjectStore,
  useDeleteAllProjects as useDeleteAllProjectsStore,
} from '@/src/stores/useProjectStore';

type UpdateProjectInput = Parameters<typeof projectAdapter.updateProject>[0];

export const useProjectService = () => {
  const setProjects = useSetProjects();
  const setLoading = useSetLoading();
  const deleteProjectFromStore = useDeleteProjectStore();
  const deleteAllProjectsFromStore = useDeleteAllProjectsStore();

  const loadProjects = async () => {
    try {
      setLoading(true);
      const domainProjects = await projectAdapter.getAllProjects();
      setProjects(ProjectMapper.toUIArray(domainProjects));
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectsByStatus = async (status: string) => {
    try {
      setLoading(true);
      const domainProjects = await projectAdapter.getProjectsByStatus(status);
      setProjects(ProjectMapper.toUIArray(domainProjects));
    } catch (error) {
      console.error('Failed to load projects by status:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (data: {
    name: string;
    templateName: string;
    templateContent: Record<string, unknown>;
  }) => {
    try {
      const domainProject = await projectAdapter.createProject(data);
      await loadProjects();

      return ProjectMapper.toUI(domainProject);
    } catch (error) {
      console.error('Failed to create project:', error);

      throw error;
    }
  };

  const updateProject = async (data: UpdateProjectInput) => {
    try {
      const domainProject = await projectAdapter.updateProject(data);
      await loadProjects();

      return ProjectMapper.toUI(domainProject);
    } catch (error) {
      console.error('Failed to update project:', error);

      throw error;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await projectAdapter.deleteProject(projectId);
      deleteProjectFromStore(projectId);
      await loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);

      throw error;
    }
  };

  const deleteAllProjects = async () => {
    try {
      await projectAdapter.deleteAllProjects();
      deleteAllProjectsFromStore();
      await loadProjects();
    } catch (error) {
      console.error('Failed to delete all projects:', error);

      throw error;
    }
  };

  return { loadProjects, loadProjectsByStatus, createProject, updateProject, deleteProject, deleteAllProjects };
};
