// Per-channel colour grade sliders (brightness / contrast / saturation / gamma / hue / blur) for
// visual scenes — the fine-tune layer beneath the look presets, mirroring the web GradePanel. Each
// slider resets to its no-op default; keys left at default are pruned so the descriptor never carries
// a flat grade (and the whole grade is dropped to undefined once everything is neutral).
import React from 'react';
import { View } from 'react-native';
import type { TFunction } from 'i18next';
import { Slider } from './EditorControls';
import type { Grade } from '../model/templateEditorModel';

const GRADE_DEFAULTS = { brightness: 0, contrast: 1, saturation: 1, gamma: 1, hue: 0, blur: 0 } as const;

type GradeKey = keyof typeof GRADE_DEFAULTS;

const SPECS: ReadonlyArray<{ key: GradeKey; min: number; max: number; step: number }> = [
  { key: 'brightness', min: -1, max: 1, step: 0.05 },
  { key: 'contrast', min: 0, max: 2, step: 0.05 },
  { key: 'saturation', min: 0, max: 3, step: 0.05 },
  { key: 'gamma', min: 0.1, max: 3, step: 0.05 },
  { key: 'hue', min: -180, max: 180, step: 1 },
  { key: 'blur', min: 0, max: 20, step: 0.5 },
];

// Drop graded channels that sit at their neutral default, preserving any keys this UI doesn't manage.
const pruneGrade = (grade: Grade): Grade | undefined => {
  const next: Grade = { ...grade };

  for (const { key } of SPECS) {
    if (next[key] === undefined || next[key] === GRADE_DEFAULTS[key]) delete next[key];
  }

  return Object.keys(next).length > 0 ? next : undefined;
};

interface GradeFieldsProps {
  grade: Grade | undefined;
  t: TFunction<'editor'>;
  onChange: (grade: Grade | undefined) => void;
}

export const GradeFields = ({ grade, t, onChange }: GradeFieldsProps) => (
  <View>
    {SPECS.map((spec) => (
      <Slider
        key={spec.key}
        label={t(`grade.${spec.key}`)}
        value={grade?.[spec.key] ?? GRADE_DEFAULTS[spec.key]}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        resetTo={GRADE_DEFAULTS[spec.key]}
        format={(v) => (spec.key === 'hue' ? `${Math.round(v)}°` : v.toFixed(2))}
        onChange={(value) => {
          onChange(pruneGrade({ ...grade, [spec.key]: value }));
        }}
      />
    ))}
  </View>
);
