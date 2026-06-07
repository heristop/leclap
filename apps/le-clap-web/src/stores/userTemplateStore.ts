import type { Template } from '@/services/templateService';

// A user-authored template persisted in localStorage. Built-ins are `source: 'sample'`.
// Spelled as an intersection (rather than `extends Template`) so every inherited
// member — id/name/etc. — is part of this type's own member set; the linter's
// type-aware pass resolves those directly instead of chasing the cross-module base.
export type StoredTemplate = Template & {
  source: 'user';
  createdAt: number;
  updatedAt: number;
};

// Structural slice of the core TemplateValidator — injected so this module stays
// free of the core package (keeps it trivially unit-testable in a node env).
export interface DescriptorValidator {
  validateTemplate(descriptor: unknown): { success: boolean; errors?: Array<{ message: string }> };
}

const STORAGE_KEY = 'leclap.user-templates';

/**
 * CRUD for user-created templates backed by an injectable `Storage` (defaults to
 * localStorage in the app wiring). Every descriptor is validated through the core
 * schema before it is persisted, so a stored template is always compile-valid.
 */
export class UserTemplateService {
  constructor(
    private readonly storage: Storage | null,
    private readonly validator: DescriptorValidator,
    private readonly now: () => number = () => Date.now(),
    private readonly makeId: () => string = defaultMakeId
  ) {}

  list(): StoredTemplate[] {
    if (!this.storage) return [];

    try {
      const raw = this.storage.getItem(STORAGE_KEY);

      if (!raw) return [];

      const parsed: unknown = JSON.parse(raw);

      return Array.isArray(parsed) ? (parsed as StoredTemplate[]) : [];
    } catch {
      return [];
    }
  }

  get(id: string): StoredTemplate | null {
    return this.list().find((t) => t.id === id) ?? null;
  }

  save(template: Template): StoredTemplate {
    const result = this.validator.validateTemplate(template.descriptor);

    if (!result.success) {
      const detail = result.errors?.map((e) => e.message).join(', ') ?? 'invalid template descriptor';

      throw new Error(`Cannot save template: ${detail}`);
    }

    const timestamp = this.now();
    const existing = this.list();
    const index = existing.findIndex((t) => t.id === template.id);

    const stored: StoredTemplate = {
      ...template,
      source: 'user',
      createdAt: index >= 0 ? existing[index].createdAt : timestamp,
      updatedAt: timestamp,
    };

    const next = index >= 0 ? existing.map((t, i) => (i === index ? stored : t)) : [...existing, stored];
    this.persist(next);

    return stored;
  }

  remove(id: string): void {
    this.persist(this.list().filter((t) => t.id !== id));
  }

  duplicate(template: Template): StoredTemplate {
    return this.save({ ...template, id: this.makeId(), name: `${template.name} (copy)` });
  }

  private persist(templates: StoredTemplate[]): void {
    if (!this.storage) return;

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // Quota exceeded / private mode — best-effort; the in-memory list is unchanged.
    }
  }
}

function defaultMakeId(): string {
  try {
    return `user-${globalThis.crypto.randomUUID()}`;
  } catch {
    return `user-${Date.now()}`;
  }
}
