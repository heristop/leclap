// The CSS family a sugar preview draws an authored font with — shared by the caption and title-card
// previews so both follow the engine's resolveFontFile the same way (text.ts): a registry id → its CSS
// family; a known .ttf filename → its registry family; a font named by family → that family verbatim
// (a Google family name IS its CSS family, so the preview matches the render as long as the browser has
// the face); anything else keeps the preset family (an unknown .ttf renders server-side, but the
// browser has no face for it).
import { findFont, findFontByFile, isFontRef, type FontInput } from '@leclap/creative-kit/fonts';

export function previewFontFamily(font: FontInput | undefined, presetFamily: string): string {
  if (!font) return presetFamily;

  if (isFontRef(font)) return font.family;

  const byId = findFont(font);

  if (byId) return byId.cssFamily;

  if (font.endsWith('.ttf')) return findFontByFile(font)?.cssFamily ?? presetFamily;

  return presetFamily;
}
