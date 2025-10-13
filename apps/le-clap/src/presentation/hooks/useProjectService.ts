import { useCallback } from 'react';
import { projectAdapter } from '@/src/presentation/adapters/ProjectAdapter';
import { ProjectMapper } from '@/src/presentation/mappers/ProjectMapper';
import {
  useSetProjects,
  useSetLoading,
  useDeleteProject as useDeleteProjectStore,
  useDeleteAllProjects as useDeleteAllProjectsStore,
} from '@/src/stores/useProjectStore';

export const useProjectService = () => {
  const setProjects = useSetProjects();
  const setLoading = useSetLoading();
  const deleteProjectFromStore = useDeleteProjectStore();
  const deleteAllProjectsFromStore = useDeleteAllProjectsStore();

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const domainProjects = await projectAdapter.getAllProjects();
      const uiProjects = ProjectMapper.toUIArray(domainProjects);
      setProjects(uiProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  }, [setProjects, setLoading]);

  const loadProjectsByStatus = useCallback(
    async (status: string) => {
      try {
        setLoading(true);
        const domainProjects = await projectAdapter.getProjectsByStatus(status);
        const uiProjects = ProjectMapper.toUIArray(domainProjects);
        setProjects(uiProjects);
      } catch (error) {
        console.error('Failed to load projects by status:', error);
      } finally {
        setLoading(false);
      }
    },
    [setProjects, setLoading]
  );

  const createProject = useCallback(
    async (data: { name: string; templateName: string; templateContent: Record<string, unknown> }) => {
      try {
        const domainProject = await projectAdapter.createProject(data);
        await loadProjects();
        return ProjectMapper.toUI(domainProject);
      } catch (error) {
        console.error('Failed to create project:', error);
        throw error;
      }
    },
    [loadProjects]
  );

  const updateProject = useCallback(
    async (data: {
      id: string;
      name?: string;
      formData?: Record<string, unknown>;
      recordedVideos?: Record<
        string,
        { path: string; orientation?: string; duration?: number; width?: number; height?: number; recordedAt?: string }
      >;
      outputVideoUri?: string;
      thumbnailUri?: string;
    }) => {
      try {
        const domainProject = await projectAdapter.updateProject(data);
        await loadProjects();
        return ProjectMapper.toUI(domainProject);
      } catch (error) {
        console.error('Failed to update project:', error);
        throw error;
      }
    },
    [loadProjects]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      try {
        await projectAdapter.deleteProject(projectId);
        deleteProjectFromStore(projectId);
        await loadProjects(); // Refresh the project list from storage
      } catch (error) {
        console.error('Failed to delete project:', error);
        throw error;
      }
    },
    [deleteProjectFromStore, loadProjects]
  );

  const deleteAllProjects = useCallback(async () => {
    try {
      await projectAdapter.deleteAllProjects();
      deleteAllProjectsFromStore();
      await loadProjects(); // Refresh the project list from storage
    } catch (error) {
      console.error('Failed to delete all projects:', error);
      throw error;
    }
  }, [deleteAllProjectsFromStore, loadProjects]);

  return {
    loadProjects,
    loadProjectsByStatus,
    createProject,
    updateProject,
    deleteProject,
    deleteAllProjects,
  };
};
