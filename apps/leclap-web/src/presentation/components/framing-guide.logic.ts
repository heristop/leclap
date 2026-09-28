import { DEFAULT_FRAMING_OPACITY } from '@/presentation/components/admin/templateEditorModel';

export interface GuideLayers {
  // The light contour.
  line: number;
  // The dark halo under it, which keeps the line readable over bright or busy feeds.
  halo: number;
  // The shade over everything outside the silhouette.
  dim: number;
}

// Each layer at the template's default opacity, and the most it may ever reach.
const AT_DEFAULT: GuideLayers = { line: 0.8, halo: 0.35, dim: 0.25 };
const CEILING: GuideLayers = { line: 1, halo: 0.6, dim: 0.4 };

// A template's framing opacity (0–1, default DEFAULT_FRAMING_OPACITY) read as the guide's overall
// strength, relative to the default, rather than as a flat CSS opacity: applied flat, the default 0.45
// took the 80% line down to ~35% and it vanished on any busy feed. So the default draws the line, halo
// and dim at their designed strength, lower values fade them together, higher ones firm them up to a
// ceiling that still never blacks the scene out.
export const guideLayers = (opacity: number): GuideLayers => {
  const strength = Math.max(0, opacity) / DEFAULT_FRAMING_OPACITY;
  const layer = (name: keyof GuideLayers): number => Math.min(CEILING[name], AT_DEFAULT[name] * strength);

  return { line: layer('line'), halo: layer('halo'), dim: layer('dim') };
};
