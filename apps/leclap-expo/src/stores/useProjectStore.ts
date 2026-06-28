import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';
import { zustandMmkvStorage } from '@/src/services/mmkv';
import type { Project } from '@/src/types';

interface ProjectStore {
  // State
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  deleteAllProjects: () => void;
  setCurrentProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;

  // Computed
  getProjectById: (id: string) => Project | undefined;
  getProjectsSortedByDate: () => Project[];
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      currentProject: null,
      isLoading: false,
      hasHydrated: false,

      setHasHydrated: (state) => set({ hasHydrated: state }),

      // Actions
      setProjects: (projects) => set({ projects }),

      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
        })),

      updateProject: (project) =>
        set((state) => ({
          projects: state.projects.map((p) => (p.id === project.id ? project : p)),
          currentProject: state.currentProject?.id === project.id ? project : state.currentProject,
        })),

      deleteProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
        })),

      deleteAllProjects: () => set({ projects: [], currentProject: null }),

      setCurrentProject: (project) => set({ currentProject: project }),

      setLoading: (loading) => set({ isLoading: loading }),

      // Computed
      getProjectById: (id) => {
        const { projects } = get();

        return projects.find((p) => p.id === id);
      },

      getProjectsSortedByDate: () => {
        const { projects } = get();

        // Return a new sorted array without mutating the store's array.
        // Spread + sort (Hermes lacks Array.prototype.toSorted).
        return [...projects].sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      },
    }),
    {
      name: 'project-store',
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (state) => ({
        projects: state.projects,
        // Don't persist currentProject, isLoading, or hasHydrated
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Helper hooks for common operations
export const useProjects = () => useProjectStore((state) => state.projects);
export const useCurrentProject = () => useProjectStore((state) => state.currentProject);

// Individual action selectors with stable references
export const useSetProjects = () => useProjectStore((state) => state.setProjects);
export const useAddProject = () => useProjectStore((state) => state.addProject);
export const useUpdateProject = () => useProjectStore((state) => state.updateProject);
export const useDeleteProject = () => useProjectStore((state) => state.deleteProject);
export const useDeleteAllProjects = () => useProjectStore((state) => state.deleteAllProjects);
export const useSetCurrentProject = () => useProjectStore((state) => state.setCurrentProject);
export const useSetLoading = () => useProjectStore((state) => state.setLoading);

// For backwards compatibility - using shallow comparison
export const useProjectActions = () =>
  useProjectStore(
    useShallow((state) => ({
      setProjects: state.setProjects,
      addProject: state.addProject,
      updateProject: state.updateProject,
      deleteProject: state.deleteProject,
      deleteAllProjects: state.deleteAllProjects,
      setCurrentProject: state.setCurrentProject,
      setLoading: state.setLoading,
    }))
  );
