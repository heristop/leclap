/** Normalize user hex input to a canonical lowercase `#rrggbb`, or null if invalid. */
export function normalizeHex(input: string): string | null {
  let v = input.trim().toLowerCase();

  if (v && !v.startsWith('#')) v = `#${v}`;

  // Expand 3-digit shorthand (#abc -> #aabbcc).
  if (/^#[0-9a-f]{3}$/.test(v)) {
    v = v.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3');
  }

  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}

/**
 * On-brand quick-pick swatches for the color picker. Rows of 4 (the picker grid wraps at 4):
 * brand trio + white, saturated primaries, warm range, cool range, pastels, then a neutral ramp —
 * enough spread to style titles/cards/bands without opening the native picker.
 */
export const BRAND_SWATCHES = [
  '#7c83fd', // brand lavender
  '#ff8aae', // secondary pink
  '#fff685', // accent yellow
  '#ffffff', // white
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#fda4af', // rose pastel
  '#fed7aa', // peach pastel
  '#bbf7d0', // mint pastel
  '#bae6fd', // sky pastel
  '#e9d5ff', // lilac pastel
  '#a8a29e', // warm gray
  '#64748b', // slate
  '#374151', // charcoal
  '#1f2937', // ink
  '#0f0f12', // near-black
  '#000000', // black
] as const;
