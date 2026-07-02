import type { Template, Project } from '@/src/types';

// Substitute every `{{ key }}` placeholder in the template JSON with the viewer's answer. Works on a
// deep clone serialized to a string; the key is regex-escaped so a field name with special characters
// can't inject a pattern. Pure — the escaping is worth a unit test.
export function compileTemplate(content: Template['content'], formData: Project['formData']): Record<string, unknown> {
  let str = JSON.stringify(JSON.parse(JSON.stringify(content)) as unknown);

  for (const [key, value] of Object.entries(formData)) {
    str = str.replace(new RegExp(`{{ ${key} }}`.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`), 'g'), String(value));
  }

  return JSON.parse(str) as Record<string, unknown>;
}
