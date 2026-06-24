// Pure CSS-filter approximations of the engine's looks and grades, used only to make
// the builder's preview thumbnails *look* like the chosen effect. These are deliberately
// rough stand-ins — the real grade is applied by FFmpeg at compile time — but they let an
// author pick a look/grade visually instead of by name.
import type { Grade } from '../templateEditorModel';
import type { LOOK_PRESETS } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';

export type LookName = (typeof LOOK_PRESETS)[number];

// Per-look CSS `filter` string approximating the preset's mood on a sample image.
// Typed as a partial record so an unknown look name reads `undefined` (→ 'none').
const LOOK_FILTERS: Partial<Record<string, string>> = {
  cinematic: 'contrast(1.18) saturate(1.1) brightness(0.96)',
  warm: 'sepia(0.35) saturate(1.25) hue-rotate(-12deg) brightness(1.04)',
  cool: 'saturate(1.05) hue-rotate(18deg) brightness(1.02)',
  vintage: 'sepia(0.55) contrast(0.92) saturate(0.85) brightness(1.05)',
  noir: 'grayscale(1) contrast(1.3) brightness(0.95)',
  vivid: 'saturate(1.7) contrast(1.08)',
  dreamy: 'blur(1.2px) brightness(1.12) saturate(1.15)',
  // LUT-backed looks (lut3d) — CSS stand-ins for their .cube grades.
  'teal-orange': 'contrast(1.12) saturate(1.2) sepia(0.12) hue-rotate(-6deg)',
  'warm-film': 'sepia(0.3) saturate(1.12) brightness(1.04) contrast(1.05)',
  'mono-film': 'grayscale(1) contrast(1.06)',
  'noir-film': 'grayscale(1) contrast(1.38) brightness(0.94)',
  'vivid-pop': 'saturate(1.75) contrast(1.12)',
};

// The CSS filter for a look name, or 'none' for an unknown/cleared look.
export function lookFilter(look: string | undefined): string {
  if (!look) return 'none';

  return LOOK_FILTERS[look] ?? 'none';
}

// The default value for each grade field (matches the schema's documented defaults).
// Used both to seed sliders and to omit unchanged fields from the descriptor.
export const GRADE_DEFAULTS = {
  brightness: 0,
  contrast: 1,
  saturation: 1,
  gamma: 1,
  hue: 0,
  blur: 0,
} as const;

export type GradeKey = keyof typeof GRADE_DEFAULTS;

// A CSS `filter` string approximating a grade. gamma has no direct CSS analogue, so
// it is folded into brightness (gamma<1 darkens, >1 brightens) for the preview only.
export function gradeFilter(grade: Grade | undefined): string {
  if (!grade) return 'none';

  const brightness = (grade.brightness ?? 0) + 1;
  const gammaAsBrightness = 1 / (grade.gamma ?? 1);
  const parts = [
    `brightness(${(brightness * gammaAsBrightness).toFixed(3)})`,
    `contrast(${grade.contrast ?? 1})`,
    `saturate(${grade.saturation ?? 1})`,
    `hue-rotate(${grade.hue ?? 0}deg)`,
    `blur(${grade.blur ?? 0}px)`,
  ];

  return parts.join(' ');
}

// Drop any slider field still at its default, returning `undefined` when nothing
// remains — so buildDescriptor never writes a no-op grade into the descriptor.
// colorBalance/curvesPreset aren't surfaced by the panel sliders; pass them through
// untouched so editing a slider never silently discards an author-set grade.
export function pruneGrade(grade: Grade): Grade | undefined {
  const out: Grade = {};

  if (grade.colorBalance !== undefined) out.colorBalance = grade.colorBalance;

  if (grade.curvesPreset !== undefined) out.curvesPreset = grade.curvesPreset;

  for (const key of Object.keys(GRADE_DEFAULTS) as GradeKey[]) {
    const value = grade[key];

    if (value !== undefined && value !== GRADE_DEFAULTS[key]) {
      out[key] = value;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}
