import type { Template, Project } from '@/src/types';

// Substitute every `{{ key }}` placeholder in the template JSON with the viewer's answer. The
// substitution runs over the serialized template. The key is regex-escaped so a field name with
// special characters can't inject a pattern. The value is JSON-escaped (minus its wrapping quotes)
// so quotes/newlines/backslashes in an answer stay valid JSON, and it's spliced via a replacement
// function so `$`-sequences in the answer land literally instead of acting as replacement patterns.
export function compileTemplate(content: Template['content'], formData: Project['formData']): Record<string, unknown> {
  let str = JSON.stringify(content);

  for (const [key, value] of Object.entries(formData)) {
    const pattern = new RegExp(`{{ ${key} }}`.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`), 'g');
    const escaped = JSON.stringify(String(value)).slice(1, -1);
    str = str.replace(pattern, () => escaped);
  }

  return JSON.parse(str) as Record<string, unknown>;
}
