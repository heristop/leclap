import type { Template } from '@/services/templateService';
import type { TemplatePartial } from '@leclap/creative-kit/partials';

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// The descriptor's global.variables are `Record<string, string | string[]>`; a partial's variables
// must be `Record<string, string>`. Keep them only when every value is a plain string.
function stringVariables(variables: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!variables) {
    return undefined;
  }

  const entries = Object.entries(variables);

  if (entries.length === 0) {
    return undefined;
  }

  if (entries.some(([, value]) => typeof value !== 'string')) {
    return undefined;
  }

  return Object.fromEntries(entries) as Record<string, string>;
}

/** Convert a template into a reusable partial draft, carrying its sections and string variables. */
export function templateToPartial(template: Template): TemplatePartial {
  const variables = stringVariables(template.descriptor.global?.variables);
  const base: TemplatePartial = {
    id: `local:${slug(template.name)}`,
    description: template.description || template.name,
    sections: (template.descriptor.sections ?? []) as TemplatePartial['sections'],
  };

  if (!variables) {
    return base;
  }

  return { ...base, variables };
}
