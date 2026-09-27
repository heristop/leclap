import { findFont, isFontRef, type FontInput } from '../fonts';

// How an editor summary names a font: the registry label for a curated id, the family (plus a weight
// or style when set) for a font named by family, or the value as typed (e.g. a raw .ttf filename).
export function fontLabel(font: FontInput): string {
  if (isFontRef(font)) {
    return [font.family, font.weight, font.style === 'italic' ? 'italic' : undefined].filter(Boolean).join(' ');
  }

  return findFont(font)?.label ?? font;
}
