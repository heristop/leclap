// "Fine-tune" collapsible under the LookGallery: six grade sliders with per-field
// reset and a live CSS-filter preview. Maps 1:1 to section.grade (GradeSchema);
// unchanged fields are pruned so the descriptor never carries no-op defaults.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Grade } from '../templateEditorModel';
import { GRADE_DEFAULTS, gradeFilter, pruneGrade, type GradeKey } from './lookFilters';
import { PreviewSurface } from './PreviewSurface';
import { RangeSlider } from './controls';

interface GradePanelProps {
  grade: Grade | undefined;
  onChange: (grade: Grade | undefined) => void;
}

interface SliderSpec {
  key: GradeKey;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderSpec[] = [
  { key: 'brightness', min: -1, max: 1, step: 0.05 },
  { key: 'contrast', min: 0, max: 2, step: 0.05 },
  { key: 'saturation', min: 0, max: 3, step: 0.05 },
  { key: 'gamma', min: 0.1, max: 3, step: 0.05 },
  { key: 'hue', min: -180, max: 180, step: 1 },
  { key: 'blur', min: 0, max: 20, step: 0.5 },
];

export const GradePanel = ({ grade, onChange }: GradePanelProps) => {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  const active = grade !== undefined && Object.keys(grade).length > 0;

  const setField = (key: GradeKey, value: number) => {
    onChange(pruneGrade({ ...grade, [key]: value }));
  };

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface/40">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="tap flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" /> {t('grade.fineTune')}
        {active && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-label={t('grade.customised')} />}
        <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-4 px-3 pb-3 sm:grid-cols-[1fr_8rem]">
          <div className="grid gap-3 sm:grid-cols-2">
            {SLIDERS.map((spec) => (
              <RangeSlider
                key={spec.key}
                label={t(`grade.${spec.key}`)}
                value={grade?.[spec.key] ?? GRADE_DEFAULTS[spec.key]}
                min={spec.min}
                max={spec.max}
                step={spec.step}
                resetTo={GRADE_DEFAULTS[spec.key]}
                onChange={(v) => {
                  setField(spec.key, v);
                }}
              />
            ))}
          </div>
          <PreviewSurface filter={gradeFilter(grade)} className="h-24 w-full sm:sticky sm:top-2 sm:self-start" />
        </div>
      )}
    </div>
  );
};
