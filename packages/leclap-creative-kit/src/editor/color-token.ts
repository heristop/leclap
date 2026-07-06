// Colour fields accept '{{ name }}' variable tokens: the engine's FormatterManager.formatColor
// resolves them at compile time from global.variables ({{ colorN }} reads the colorsList palette).
// This is the AUTHORING-side mirror — pure helpers the editors use to show a token's current colour
// in pickers and canvas previews without touching the stored token.

/** The shape of a template's variable map as previews see it (global.variables). */
export type ColorVariableMap = Record<string, string | string[] | undefined>;

const FULL_TOKEN = /^\{\{\s*(\w+)\s*\}\}$/;
const COLOR_SLOT = /^color(\d+)$/;

// Guard against self/mutual token cycles ({{ a }} -> {{ b }} -> {{ a }}).
const MAX_HOPS = 4;

/** The variable name when `value` is exactly one '{{ name }}' token, else null. */
export function colorTokenName(value: string): string | null {
  return FULL_TOKEN.exec(value)?.[1] ?? null;
}

// Look one token hop up: colorN reads the palette slot (1-indexed), anything else the named variable.
function lookup(name: string, variables: ColorVariableMap, colorsList: readonly string[]): string | null {
  const slot = COLOR_SLOT.exec(name);

  if (slot) return colorsList[Number(slot[1]) - 1] ?? null;

  const value = variables[name];

  return typeof value === 'string' ? value : null;
}

/**
 * Resolve a colour field value against the template's variables: literal colours pass through
 * untouched; a '{{ name }}' token resolves to its current colour (following variable-to-variable
 * chains a few hops). Returns null when the value is empty or the token cannot be resolved —
 * callers render a checkerboard / keep the raw value.
 */
export function resolveColorToken(
  value: string | undefined,
  variables: ColorVariableMap = {},
  colorsList?: readonly string[]
): string | null {
  if (!value) return null;

  const palette = colorsList ?? (Array.isArray(variables.colorsList) ? variables.colorsList : []);
  let current = value;

  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const name = colorTokenName(current);

    if (name === null) return current;

    const next = lookup(name, variables, palette);

    if (next === null || next === current) return null;

    current = next;
  }

  return null;
}

/**
 * Preview-friendly resolution: like resolveColorToken, but an unresolvable token falls back to the
 * raw value (an invalid CSS colour, which the browser ignores) instead of null — so canvas mirrors
 * can inline it without null checks.
 */
export function resolvePreviewColor(value: string, variables?: ColorVariableMap): string {
  return resolveColorToken(value, variables) ?? value;
}

/** Editor rows ({name, value}[]) as the plain variable map previews resolve against. */
export function toColorVariableMap(rows: readonly { name: string; value: string }[]): Record<string, string> {
  return Object.fromEntries(rows.filter((row) => row.name.trim() !== '').map((row) => [row.name, row.value]));
}
