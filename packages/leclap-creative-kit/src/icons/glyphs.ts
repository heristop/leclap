import data from './glyphs.json';

// The LeClap icon set: one 24-unit drawing per icon (glyphs.json), shared by the web app and the Expo app.
// Duotone: every part is a 2-unit round line in the text colour; the `fill` parts also take a soft brand tint
// (the brand gradient when hovered or active), and `solid` parts are filled with the line colour. `motion`
// names the one gesture an icon makes on hover (web only for now); it moves the `move` parts (all of them when
// unset) and, offset in time, the `move2` parts, around `origin` (the centre when unset).
// House style: live area 3–21, containers with 2.5–3 corners, full circles r 9, one tinted part per idea.
// Both apps render this table, so a change lands on web and mobile together. Never give a part a
// `transform`: the web gestures move parts with CSS, which would replace it.

export type GlyphTag = 'path' | 'circle' | 'ellipse' | 'rect' | 'line' | 'polyline' | 'polygon';
export type GlyphPart = readonly [GlyphTag, Readonly<Record<string, string>>];

export const ICON_MOTIONS = [
  'blink',
  'bob',
  'clap',
  'draw',
  'drop',
  'lid',
  'lift',
  'nudge',
  'pop',
  'pulse',
  'rise',
  'scan',
  'shake',
  'slide-down',
  'slide-knobs',
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-up-right',
  'snip',
  'spin',
  'spin-back',
  'spin-half',
  'spin-quarter',
  'spin-y',
  'spread',
  'spread-x',
  'spread-y',
  'squash',
  'sweep',
  'tilt',
  'twinkle',
  'wave',
] as const;

export type IconMotion = (typeof ICON_MOTIONS)[number];

export interface Glyph {
  readonly parts: readonly GlyphPart[];
  /** Parts drawn with the soft brand tint (the duotone fill). */
  readonly fill: readonly number[];
  /** Parts filled solid with the line colour (dots). */
  readonly solid?: readonly number[];
  readonly motion?: IconMotion;
  /** Parts the motion moves; every part when unset. */
  readonly move?: readonly number[];
  /** A second group, moved a beat later or the other way (scissor blades, pause bars). */
  readonly move2?: readonly number[];
  /** The motion's pivot in the 24-unit grid; the centre when unset. */
  readonly origin?: readonly [number, number];
}

export type IconName = keyof typeof data;

// JSON widens the tags and motions to strings; tests/icons.test.ts checks every entry against Glyph.
export const GLYPHS = data as unknown as Readonly<Record<IconName, Glyph>>;

export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];
