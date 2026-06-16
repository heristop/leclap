// Shared app template discovery. The generated registry imports every JSON in src/templates/, so
// adding a template is just adding a descriptor file with optional human-facing `meta` fields.
import type { AppTemplateCategory, TemplateComplexity, TemplateDescriptor, TemplateOrientation } from './types';
import { TEMPLATE_DESCRIPTORS } from './templates.generated';

export interface AppTemplate {
  /** Stable catalog id (hyphenated), shared by web + expo. */
  id: string;
  name: string;
  description: string;
  category: AppTemplateCategory;
  complexity: TemplateComplexity;
  orientation: TemplateOrientation;
  /** True when the descriptor has a `form` section (the app collects fields before compiling). */
  hasForm: boolean;
  descriptor: TemplateDescriptor;
}

const titleCase = (id: string): string =>
  id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const orientationOf = (d: TemplateDescriptor): TemplateOrientation =>
  d.global?.orientation === 'portrait' ? 'portrait' : 'landscape';

const hasFormOf = (d: TemplateDescriptor): boolean => (d.sections ?? []).some((s) => s.type === 'form');

const categoryOf = (descriptor: TemplateDescriptor): AppTemplateCategory =>
  orientationOf(descriptor) === 'portrait' ? 'portrait' : 'advanced';

const complexityOf = (descriptor: TemplateDescriptor): TemplateComplexity => {
  const count = descriptor.sections?.length ?? 0;

  if (count <= 3) return 'simple';

  if (count <= 6) return 'intermediate';

  return 'advanced';
};

const complexityOrder: Record<TemplateComplexity, number> = { simple: 0, intermediate: 1, advanced: 2 };

const define = (id: string, raw: unknown): AppTemplate => {
  const descriptor = raw as TemplateDescriptor;
  const meta = descriptor.meta ?? {};

  return {
    id,
    name: meta.name ?? titleCase(id),
    description: meta.description ?? 'LeClap template.',
    category: categoryOf(descriptor),
    complexity: complexityOf(descriptor),
    orientation: orientationOf(descriptor),
    hasForm: hasFormOf(descriptor),
    descriptor,
  };
};

export const APP_TEMPLATES: AppTemplate[] = Object.entries(TEMPLATE_DESCRIPTORS)
  .map(([id, descriptor]) => define(id, descriptor))
  .sort((a, b) => complexityOrder[a.complexity] - complexityOrder[b.complexity] || a.name.localeCompare(b.name));

export const APP_TEMPLATES_BY_ID: Record<string, AppTemplate | undefined> = Object.fromEntries(
  APP_TEMPLATES.map((t) => [t.id, t])
);

export type { AppTemplateCategory, TemplateComplexity, TemplateDescriptor } from './types';
