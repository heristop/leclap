import { useCallback, useState } from 'react';
import { listProjects, deleteProject, renameProject, duplicateProject } from '@/services/projectService';
import type { StoredProject } from '@/lib/projectModel';

// Reads the saved projects (newest first) for the Projects page, with mutations that keep the list
// in sync (each purges/clones the project's blobs as needed).
export const useProjects = () => {
  const [projects, setProjects] = useState<StoredProject[]>(() => listProjects());

  const refresh = useCallback(() => {
    setProjects(listProjects());
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteProject(id);
    setProjects(listProjects());
  }, []);

  const rename = useCallback((id: string, name: string) => {
    renameProject(id, name);
    setProjects(listProjects());
  }, []);

  const duplicate = useCallback(async (id: string) => {
    await duplicateProject(id);
    setProjects(listProjects());
  }, []);

  return { projects, refresh, remove, rename, duplicate };
};
