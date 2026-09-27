// The lowerThird preset's layout as the geometry model reads it: a translucent band anchored top or
// bottom, with a left-margined title and subtitle inside it. Mirrored by hand from
// `lowerThirdToFilters` (editor/presets/text-blocks.ts) — unlike the caption numbers, which come from
// the shared `caption-layout.ts`, the lowerThird's are tangled up with the band/accent/badge filters
// and want the same extraction. Until then these can drift, and there is no test that would notice.
// They match `text-blocks.ts` as of this writing (which rounds each to whole pixels; this does not —
// a sub-pixel difference). The badge line is absent here entirely and so is never measured.
export const LOWER_THIRD_MARGIN_RATIO = 0.06;
export const LOWER_THIRD_BAND_HEIGHT_RATIO = 0.2;

// The band's defaults. LowerThirdSchema overrides the band (`bandColor`, `boxOpacity`) but has no
// colour override for the text itself, which is why each line below carries a fixed colour.
export const LOWER_THIRD_DEFAULT_BAND_COLOR = '#0a0f14';
export const LOWER_THIRD_DEFAULT_BAND_OPACITY = 0.6;

export interface LowerThirdLineSpec {
  key: 'title' | 'subtitle';
  font: string;
  yRatio: number;
  sizeRatio: number;
  color: string;
}

export const LOWER_THIRD_LINES: LowerThirdLineSpec[] = [
  { key: 'title', font: 'Anton.ttf', yRatio: 0.055, sizeRatio: 0.05, color: '#ffffff' },
  { key: 'subtitle', font: 'Oswald.ttf', yRatio: 0.125, sizeRatio: 0.028, color: '#c9d0f5' },
];
