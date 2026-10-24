import { GLYPHS, type Glyph, type GlyphPart, type IconName } from './glyphs';

export {
  GLYPHS,
  ICON_MOTIONS,
  ICON_NAMES,
  type Glyph,
  type GlyphPart,
  type GlyphTag,
  type IconMotion,
  type IconName,
} from './glyphs';

/** How one part of a glyph is painted and whether its motion moves it (0: still, 1: first group, 2: second). */
export interface PartRole {
  readonly tint: boolean;
  readonly solid: boolean;
  readonly group: 0 | 1 | 2;
}

function groupOf(glyph: Glyph, index: number): 0 | 1 | 2 {
  if (glyph.motion === undefined) return 0;

  if (glyph.move2?.includes(index)) return 2;

  if (glyph.move === undefined || glyph.move.includes(index)) return 1;

  return 0;
}

/** Each part of a glyph with its paint and motion group, in drawing order. */
export function glyphParts(name: IconName): readonly (readonly [GlyphPart, PartRole])[] {
  const glyph = GLYPHS[name];

  return glyph.parts.map((part, index) => [
    part,
    {
      tint: glyph.fill.includes(index),
      solid: glyph.solid?.includes(index) ?? false,
      group: groupOf(glyph, index),
    },
  ]);
}

/** True when the glyph has a tinted part, so a renderer needs the brand gradient. */
export function hasTint(name: IconName): boolean {
  return GLYPHS[name].fill.length > 0;
}
