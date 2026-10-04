// The catalog sections beyond motion presets, indexed for catalog search: lower-third styles, caption
// identities, sound effects and voice presets, footage fits and speed ramps, motion roles, compositing
// fills and layouts, and the format guide. Pure; catalog-search.ts ranks them with everything else.

import type { MotionCatalog } from './catalog';

export const EXTRA_CATALOG_KINDS = [
  'lower-third',
  'caption',
  'sfx',
  'voice',
  'footage',
  'role',
  'compositing',
  'format',
] as const;

export type ExtraCatalogKind = (typeof EXTRA_CATALOG_KINDS)[number];

/** One searchable entry: weighted text for it, avoidWhen text against it. */
export interface SearchEntry<K extends string = string> {
  kind: K;
  name: string;
  fields: Array<[text: string, weight: number]>;
  against: string;
  entry: unknown;
}

const NAME_WEIGHT = 3;

function entry<K extends string>(kind: K, name: string, text: string, value: unknown, against = '') {
  const fields: Array<[string, number]> = [
    [name, NAME_WEIGHT],
    [text, 1.5],
  ];

  return { kind, name, fields, against, entry: value };
}

function described(kind: ExtraCatalogKind, record: Record<string, string>): Array<SearchEntry<ExtraCatalogKind>> {
  return Object.entries(record).map(([name, text]) => entry(kind, name, text, { name, description: text }));
}

function audioEntries(catalog: MotionCatalog): Array<SearchEntry<ExtraCatalogKind>> {
  return [
    ...catalog.audio.sfx.map((sfx) => entry('sfx' as const, sfx.id, `sound effect ${sfx.useWhen}`, sfx, sfx.avoidWhen)),
    ...described('voice', catalog.audio.voice),
  ];
}

function footageEntries(catalog: MotionCatalog): Array<SearchEntry<ExtraCatalogKind>> {
  return [
    ...Object.entries(catalog.footage.fits).map(([name, text]) =>
      entry('footage' as const, `fit:${name}`, `footage fit ${name} ${text}`, { fit: name, description: text })
    ),
    ...catalog.footage.speedRamps.map((ramp) =>
      entry('footage' as const, `speedRamp:${ramp.preset}`, `speed ramp ${ramp.preset} ${ramp.description}`, ramp)
    ),
  ];
}

function styleEntries(catalog: MotionCatalog): Array<SearchEntry<ExtraCatalogKind>> {
  return [
    ...Object.entries(catalog.lowerThirds).map(([name, guide]) =>
      entry(
        'lower-third' as const,
        name,
        `lower third ${guide.verb} ${guide.useWhen} ${guide.description}`,
        guide,
        guide.avoidWhen
      )
    ),
    ...catalog.captions.styles.map((style) =>
      entry('caption' as const, style.id, `caption subtitles ${style.description}`, style)
    ),
    ...Object.entries(catalog.roles.defaults).map(([name, role]) =>
      entry('role' as const, name, `motion role ${role.useFor}`, role, role.avoid)
    ),
    ...described('compositing', { ...catalog.compositing.kineticFill, ...catalog.compositing.layouts }),
    ...catalog.formats.formats.map((name) =>
      entry('format' as const, name, `format orientation ${catalog.formats.artDirection}`, { format: name })
    ),
  ];
}

/** Every entry of the non-motion catalog sections. */
export function extraEntries(catalog: MotionCatalog): Array<SearchEntry<ExtraCatalogKind>> {
  return [...styleEntries(catalog), ...audioEntries(catalog), ...footageEntries(catalog)];
}
