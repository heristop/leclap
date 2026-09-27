// The registry font pickers (caption, title-card lines, whole-video overlays) only list curated ids.
// A font named by family (`{ family }`, authored by hand or through MCP) gets its own disabled option
// instead of posing as the default: the trigger then names the face the render actually draws, and
// picking any entry — the default included — is a real change (Radix only fires onValueChange on one).
import { isFontRef, type FontInput } from '@leclap/creative-kit/fonts';

export const FONT_REF_OPTION = '__font-ref__';

// The picker value for an authored font: a registry id as-is, FONT_REF_OPTION for a font named by
// family, `fallback` when unset.
export function fontPickerValue(font: FontInput | undefined, fallback: string): string {
  if (isFontRef(font)) return FONT_REF_OPTION;

  return font ?? fallback;
}
