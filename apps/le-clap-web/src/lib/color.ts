/** Normalize user hex input to a canonical lowercase `#rrggbb`, or null if invalid. */
export function normalizeHex(input: string): string | null {
  let v = input.trim().toLowerCase()

  if (v && !v.startsWith('#')) v = `#${v}`

  // Expand 3-digit shorthand (#abc -> #aabbcc).
  if (/^#[0-9a-f]{3}$/.test(v)) {
    v = v.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3')
  }

  return /^#[0-9a-f]{6}$/.test(v) ? v : null
}

/** On-brand quick-pick swatches for the color picker (brand, secondary, accent, neutrals, semantics). */
export const BRAND_SWATCHES = [
  '#7c83fd', // brand lavender
  '#ff8aae', // secondary pink
  '#fff685', // accent yellow
  '#ffffff', // white
  '#0f0f12', // near-black
  '#22c55e', // success green
  '#ef4444', // danger red
  '#3b82f6', // blue
] as const
