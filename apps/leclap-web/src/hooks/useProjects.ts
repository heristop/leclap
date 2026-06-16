import { useCallback, useState } from 'react';
import { listProjects, deleteProject } from '@/services/projectService';
import type { StoredProject } from '@/lib/projectModel';

// Reads the saved projects (newest first) for the Projects page, with a delete that purges the
// project's blobs and refreshes the list.
export const useProjects = () => {
  const [projects, setProjects] = useState<StoredProject[]>(() => listProjects());

  const refresh = useCallback(() => {
    setProjects(listProjects());
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteProject(id);
    setProjects(listProjects());
  }, []);

  return { projects, refresh, remove };
};
