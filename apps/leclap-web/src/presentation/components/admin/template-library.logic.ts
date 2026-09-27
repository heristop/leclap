import type { StoredTemplate } from '@/stores/userTemplateStore';

// The author's templates, most recently saved first: the one just edited leads the grid on return.
export const recentFirst = (templates: readonly StoredTemplate[]): StoredTemplate[] =>
  [...templates].sort((a, b) => b.updatedAt - a.updatedAt);
