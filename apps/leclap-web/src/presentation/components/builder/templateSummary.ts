import { type Template } from '@/services/templateService';

// Map each form field name (e.g. "form_1_name") to its descriptor label so a review shows "Name",
// not the raw machine key. Falls back to a de-slugged key when no label is authored.
export function buildFieldLabels(template: Template): Map<string, string> {
  const labels = new Map<string, string>();

  for (const section of template.descriptor.sections ?? []) {
    for (const field of section.options?.fields ?? []) {
      const label = field.label.en ?? Object.values(field.label).find(Boolean);

      if (label) labels.set(field.name, label);
    }
  }

  return labels;
}

export const humanizeKey = (key: string): string =>
  key
    .replace(/^form_\d+_/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
