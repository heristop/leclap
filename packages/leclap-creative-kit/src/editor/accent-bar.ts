// The text-overlay accent bar's stored shape and its geometry defaults. Pure — shared by the
// filter lowering (overlayFilters), the recovery (overlayParsing), and the apps' previews so
// every consumer draws the same bar.

// The accent bar's geometry knobs. `length`/`thickness` are in EM — multiples of the overlay's
// fontsize — so the bar scales with the text instead of pinning to output pixels. Every field but
// the colour is optional; the defaults reproduce the historical hardcoded bar exactly, so a bare
// colour string and an all-default object lower to identical filters.
export interface AccentBar {
  color: string;
  // Which side of the text the bar sits on; omitted = 'below' (the historical underline).
  position?: 'below' | 'above';
  // Bar length in em; omitted = 6 (the historical fontsize*6 width).
  length?: number;
  // Bar thickness in em; omitted = 0.12 (the historical fontsize*0.12, floored at 4px).
  thickness?: number;
  // Which edge of the bar rides the overlay's x anchor line; omitted = 'center'.
  align?: 'left' | 'center' | 'right';
}

// The geometry a bare colour string implies — exactly the values the kit hardcoded before the
// AccentBar object existed, so regenerated descriptors stay byte-identical.
export const ACCENT_BAR_DEFAULTS = {
  position: 'below',
  length: 6,
  thickness: 0.12,
  align: 'center',
} as const satisfies Omit<Required<AccentBar>, 'color'>;

// An accent in either stored form → the full geometry, defaults applied.
export function resolveAccentBar(accent: string | AccentBar): Required<AccentBar> {
  if (typeof accent === 'string') return { color: accent, ...ACCENT_BAR_DEFAULTS };

  return {
    color: accent.color,
    position: accent.position ?? ACCENT_BAR_DEFAULTS.position,
    length: accent.length ?? ACCENT_BAR_DEFAULTS.length,
    thickness: accent.thickness ?? ACCENT_BAR_DEFAULTS.thickness,
    align: accent.align ?? ACCENT_BAR_DEFAULTS.align,
  };
}

// The minimal stored form for an accent: default-valued fields drop out, and a geometry-free
// object collapses to the plain colour string — keeping untouched descriptors free of the object
// form. Used by the builder UI when patching geometry.
export function normalizeAccent(bar: AccentBar): string | AccentBar {
  const minimal: AccentBar = {
    color: bar.color,
    ...(bar.position === undefined || bar.position === ACCENT_BAR_DEFAULTS.position ? {} : { position: bar.position }),
    ...(bar.length === undefined || bar.length === ACCENT_BAR_DEFAULTS.length ? {} : { length: bar.length }),
    ...(bar.thickness === undefined || bar.thickness === ACCENT_BAR_DEFAULTS.thickness
      ? {}
      : { thickness: bar.thickness }),
    ...(bar.align === undefined || bar.align === ACCENT_BAR_DEFAULTS.align ? {} : { align: bar.align }),
  };

  if (Object.keys(minimal).length === 1) return minimal.color;

  return minimal;
}
