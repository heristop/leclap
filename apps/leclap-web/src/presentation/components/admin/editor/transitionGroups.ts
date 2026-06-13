// Pure derivation of the transition picker's groups + per-type CSS preview family.
// The xfade name list is the single source of truth (core's effects.schemas) — we
// only bucket those names by prefix and map each bucket to a CSS animation family,
// so the UI never hardcodes the list and can never drift from the engine.
import { XFADE_TRANSITIONS } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import type { TFunction } from 'i18next';

export type XfadeName = (typeof XFADE_TRANSITIONS)[number];

// The CSS animation families the preview thumbnail knows how to draw. Every xfade
// name maps onto exactly one of these (the nearest visual relative). The last three
// (zoom/blur/pixel) only refine the catch-all "Fades" bucket so look-alike names
// (zoomin, hblur, dissolve…) animate distinctly — they don't change the grouping.
export type PreviewFamily =
  | 'fade'
  | 'wipe'
  | 'slide'
  | 'circle'
  | 'slice'
  | 'cover'
  | 'reveal'
  | 'zoom'
  | 'blur'
  | 'pixel';

export interface TransitionGroup {
  /** Human label shown as the popover section heading. */
  label: string;
  /** The CSS preview family every member of this group animates with. */
  family: PreviewFamily;
  /** xfade names in this group, in their canonical order. */
  names: XfadeName[];
}

// Ordered (prefix-tested first → last) bucket rules. The first matching rule wins;
// anything unmatched lands in "Fades" (the safest, most generic family).
const RULES: Array<{ label: string; family: PreviewFamily; match: (name: string) => boolean }> = [
  { label: 'Wipes', family: 'wipe', match: (n) => n.startsWith('wipe') || n.startsWith('smooth') },
  { label: 'Slides', family: 'slide', match: (n) => n.startsWith('slide') || n.startsWith('squeeze') },
  {
    label: 'Circles',
    family: 'circle',
    match: (n) => n.startsWith('circle') || n.startsWith('rect') || n.includes('close') || n.includes('open'),
  },
  { label: 'Slices', family: 'slice', match: (n) => n.includes('slice') || n.includes('wind') },
  { label: 'Covers', family: 'cover', match: (n) => n.startsWith('cover') },
  { label: 'Reveals', family: 'reveal', match: (n) => n.startsWith('reveal') || n.startsWith('diag') },
];

const FADES_LABEL = 'Fades';
const FADES_FAMILY: PreviewFamily = 'fade';

// The bucket label a single xfade name belongs to (first matching rule, else Fades).
function bucketFor(name: string): { label: string; family: PreviewFamily } {
  const rule = RULES.find((r) => r.match(name));

  if (rule) return { label: rule.label, family: rule.family };

  return { label: FADES_LABEL, family: FADES_FAMILY };
}

// The CSS preview family for one xfade name (used for the group thumbnail family).
export function familyFor(name: string): PreviewFamily {
  return bucketFor(name).family;
}

// Finer per-name animation override so look-alike "Fades" members preview distinctly.
// Falls back to the group family for everything else.
const PREVIEW_OVERRIDES: Record<string, PreviewFamily> = {
  zoomin: 'zoom',
  hblur: 'blur',
  pixelize: 'pixel',
  dissolve: 'pixel',
  distance: 'pixel',
  radial: 'circle',
};

// The CSS preview family the animated thumbnail draws for one xfade name.
export function previewFamilyFor(name: string): PreviewFamily {
  return PREVIEW_OVERRIDES[name] ?? bucketFor(name).family;
}

// Group every xfade transition into ordered, non-empty buckets. "Fades" leads (it
// holds the catch-all), then each rule's bucket in declaration order — only buckets
// that actually received names are returned.
export function transitionGroups(): TransitionGroup[] {
  const order = [FADES_LABEL, ...RULES.map((r) => r.label)];
  const byLabel = new Map<string, TransitionGroup>();

  for (const name of XFADE_TRANSITIONS) {
    const { label, family } = bucketFor(name);
    const group = byLabel.get(label) ?? { label, family, names: [] };
    group.names.push(name);
    byLabel.set(label, group);
  }

  return order.map((label) => byLabel.get(label)).filter((g): g is TransitionGroup => g !== undefined);
}

// A short, human label for a boundary chip: "Cut" or e.g. "Wipe left · 0.4s".
export function transitionLabel(type: string, duration: number | undefined, t: TFunction<'admin'>): string {
  if (type === 'cut') return t('transition.cut');

  const pretty = type.charAt(0).toUpperCase() + type.slice(1);
  const secs = duration ?? 0.5;

  return t('transition.label', { name: pretty, duration: secs });
}
