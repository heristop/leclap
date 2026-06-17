// Maps the builder's `#name` shorthand to the descriptor's `{{ name }}` tokens. Authors type `#`
// to trigger an autocomplete; on pick we splice in the canonical `{{ name }}` form (what the JSON
// stores and the engine resolves). Pure + DOM-free so it's unit-testable.

export interface HashQuery {
  // Index of the `#` that opened the query.
  start: number;
  // The characters typed after `#`, up to the caret (may be empty right after `#`).
  query: string;
}

// A `#` opens a query only at the start of a word — preceded by whitespace or the start of the text,
// never mid-word (so `a#b` or a `#hex` colour stuck to a word is left alone). The query runs from the
// `#` to the caret and may contain word chars or hyphens (variable names allow neither spaces nor `{}`).
export function findHashQuery(text: string, caret: number): HashQuery | null {
  if (caret < 1 || caret > text.length) {
    return null;
  }

  let i = caret;

  while (i > 0 && /[\w-]/.test(text[i - 1])) {
    i--;
  }

  if (i === 0 || text[i - 1] !== '#') {
    return null;
  }

  const hashPos = i - 1;
  const before = hashPos > 0 ? text[hashPos - 1] : '';

  if (before !== '' && !/\s/.test(before)) {
    return null;
  }

  return { start: hashPos, query: text.slice(i, caret) };
}

// Replace the `#query` span (`start`..`caret`) with `{{ name }}`, returning the new text and the
// caret position just after the inserted token.
export function insertVariableAtHash(
  text: string,
  start: number,
  caret: number,
  name: string
): { text: string; caret: number } {
  const token = `{{ ${name} }}`;
  const next = text.slice(0, start) + token + text.slice(caret);

  return { text: next, caret: start + token.length };
}

// Filter variable names against the active query (case-insensitive substring). An empty query keeps
// the full list so the picker shows everything the moment `#` is typed.
export function filterVariables(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase();

  if (q === '') {
    return names;
  }

  return names.filter((name) => name.toLowerCase().includes(q));
}
