// Pure editing logic for the variable-aware colour field: the text input works in "draft" space
// (a hex without '#', or a bare variable name standing for its '{{ name }}' token) and commits back
// to the canonical stored value. Kept DOM-free so it is unit-tested in the node environment.
import { colorTokenName } from '@leclap/creative-kit/editor';
import { normalizeHex } from '@/lib/color';

/** The text shown in the field for a stored value: a token as its bare name, a hex without '#'. */
export function colorDraftFromValue(value: string): string {
  return colorTokenName(value) ?? value.replace(/^#/, '');
}

/** Keep only characters that can appear in a hex colour or a variable name while typing. */
export function filterColorDraft(input: string): string {
  return input.replace(/[^0-9a-zA-Z_]/g, '');
}

/**
 * Parse a committed draft into the stored value: a known variable name becomes its '{{ name }}'
 * token (the variable wins when the name also happens to be valid hex), a valid hex becomes the
 * normalized '#rrggbb'. Null means "revert" — the draft is neither.
 */
export function commitColorDraft(draft: string, knownNames: readonly string[]): string | null {
  const name = filterColorDraft(draft.trim());

  if (knownNames.includes(name)) return `{{ ${name} }}`;

  return normalizeHex(draft.trim());
}
