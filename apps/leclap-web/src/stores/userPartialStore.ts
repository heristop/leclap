import type { TemplatePartial } from '@leclap/creative-kit/partials';

export type StoredPartial = TemplatePartial & {
  source: 'local';
  createdAt: number;
  updatedAt: number;
};

export interface PartialValidator {
  validatePartial(partial: TemplatePartial): { success: boolean; errors?: Array<{ message: string }> };
}

const STORAGE_KEY = 'leclap.user-partials';

export class UserPartialService {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null,
    private readonly validator: PartialValidator,
    private readonly now: () => number = () => Date.now()
  ) {}

  list(): StoredPartial[] {
    if (!this.storage) return [];

    try {
      const raw = this.storage.getItem(STORAGE_KEY);

      if (!raw) return [];

      const parsed: unknown = JSON.parse(raw);

      return Array.isArray(parsed) ? (parsed as StoredPartial[]) : [];
    } catch {
      return [];
    }
  }

  get(id: string): StoredPartial | null {
    const normalized = normalizePartialId(id);

    return this.list().find((partial) => partial.id === normalized) ?? null;
  }

  save(partial: TemplatePartial): StoredPartial {
    const normalized: TemplatePartial = {
      ...partial,
      id: normalizePartialId(partial.id),
      description: partial.description.trim() || 'Local partial',
    };

    const result = this.validator.validatePartial(normalized);

    if (!result.success) {
      const detail = result.errors?.map((e) => e.message).join(', ') ?? 'invalid partial descriptor';

      throw new Error(`Cannot save partial: ${detail}`);
    }

    const timestamp = this.now();
    const existing = this.list();
    const index = existing.findIndex((item) => item.id === normalized.id);
    const stored: StoredPartial = {
      ...normalized,
      source: 'local',
      createdAt: index >= 0 ? existing[index].createdAt : timestamp,
      updatedAt: timestamp,
    };
    const next = index >= 0 ? existing.map((item, i) => (i === index ? stored : item)) : [...existing, stored];
    this.persist(next);

    return stored;
  }

  remove(id: string): void {
    const normalized = normalizePartialId(id);
    this.persist(this.list().filter((partial) => partial.id !== normalized));
  }

  private persist(partials: StoredPartial[]): void {
    if (!this.storage) return;

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(partials));
    } catch {
      // Quota exceeded / private mode — the caller still receives the validated object.
    }
  }
}

export function normalizePartialId(id: string): string {
  const raw = id.trim().replace(/^local:/, '');
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `local:${slug || 'partial'}`;
}
