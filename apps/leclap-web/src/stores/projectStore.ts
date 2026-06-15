import type { StoredProject } from '@/lib/projectModel';

const STORAGE_KEY = 'leclap.projects';

/**
 * CRUD for saved build sessions, backed by an injectable `Storage` (localStorage in the app wiring).
 * A dumb upsert layer — timestamps and ids are owned by the caller (projectService / modelToProject),
 * so this never re-stamps a record. Mirrors UserTemplateService's shape and best-effort semantics.
 */
export class UserProjectService {
  constructor(private readonly storage: Storage | null) {}

  list(): StoredProject[] {
    if (!this.storage) return [];

    try {
      const raw = this.storage.getItem(STORAGE_KEY);

      if (!raw) return [];

      const parsed: unknown = JSON.parse(raw);

      return Array.isArray(parsed) ? (parsed as StoredProject[]) : [];
    } catch {
      return [];
    }
  }

  get(id: string): StoredProject | null {
    return this.list().find((project) => project.id === id) ?? null;
  }

  save(project: StoredProject): StoredProject {
    const existing = this.list();
    const index = existing.findIndex((p) => p.id === project.id);
    const next = index >= 0 ? existing.map((p, i) => (i === index ? project : p)) : [...existing, project];
    this.persist(next);

    return project;
  }

  remove(id: string): void {
    this.persist(this.list().filter((project) => project.id !== id));
  }

  private persist(projects: StoredProject[]): void {
    if (!this.storage) return;

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // Quota exceeded / private mode — best-effort; the in-memory list is unchanged.
    }
  }
}

export const projectStore = new UserProjectService(typeof localStorage === 'undefined' ? null : localStorage);
