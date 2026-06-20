import type { TemplatePartial } from '@leclap/creative-kit/partials';

const TOKEN_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

// Collect every `{{ token }}` referenced in a value, deep-walking objects and arrays.
function collectTokens(node: unknown, out: string[]): void {
  if (typeof node === 'string') {
    for (const match of node.matchAll(TOKEN_RE)) {
      out.push(match[1]);
    }

    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectTokens(item, out);
    }

    return;
  }

  if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node)) {
      collectTokens(value, out);
    }
  }
}

/**
 * The variable names a partial exposes: every `{{ token }}` referenced anywhere in its sections,
 * plus the keys of its declared `variables` defaults, de-duplicated in first-seen order.
 */
export function partialVariableNames(partial: Pick<TemplatePartial, 'sections' | 'variables'>): string[] {
  const names: string[] = [];
  collectTokens(partial.sections, names);
  names.push(...Object.keys(partial.variables ?? {}));

  return [...new Set(names)];
}
