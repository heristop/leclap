// "Fine-tune" collapsible under the LookGallery: six grade sliders with per-field reset, a live
// CSS-filter preview, plus the engine's deeper grade fields — three-way color balance
// (shadows/midtones/highlights RGB) and an FFmpeg curves preset. Maps 1:1 to section.grade
// (GradeSchema); unchanged fields are pruned so the descriptor never carries no-op defaults.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ChevronDownIcon } from '@/presentation/components/icons/chevron-down';
import { SlidersHorizontalIcon } from '@/presentation/components/icons/sliders-horizontal';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/presentation/components/ui';
import type { Grade } from '../templateEditorModel';
import {
  GRADE_DEFAULTS,
  COLOR_BALANCE_RANGES,
  COLOR_CHANNELS,
  gradeFilter,
  pruneGrade,
  type GradeKey,
  type ColorBalanceRange,
  type ColorChannel,
} from './lookFilters';
import { PreviewSurface } from './PreviewSurface';
import { RangeSlider } from './controls';

// FFmpeg's built-in `curves` filter presets — grade.curvesPreset passes straight through to
// `curves=preset=<name>` (see engine editor/presets/looks.ts), so only these names are valid.
const CURVES_PRESETS = [
  'color_negative',
  'cross_process',
  'darker',
  'increase_contrast',
  'lighter',
  'linear_contrast',
  'medium_contrast',
  'negative',
  'strong_contrast',
  'vintage',
] as const;

// Sentinel for "no curves preset" — Radix Select rejects empty-string item values.
const CURVES_NONE = 'none';

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
  const { ref: slidersRef, hoverProps: slidersHoverProps } = useIconHover();
  const { ref: chevronRef, hoverProps: chevronHoverProps } = useIconHover();

  const setField = (key: GradeKey, value: number) => {
    onChange(pruneGrade({ ...grade, [key]: value }));
  };

  const setBalance = (range: ColorBalanceRange, channel: ColorChannel, value: number) => {
    const current = grade?.colorBalance?.[range] ?? { r: 0, g: 0, b: 0 };
    const colorBalance = { ...grade?.colorBalance, [range]: { ...current, [channel]: value } };
    onChange(pruneGrade({ ...grade, colorBalance }));
  };

  const setCurves = (preset: string) => {
    onChange(pruneGrade({ ...grade, curvesPreset: preset === CURVES_NONE ? undefined : preset }));
  };

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="tap flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        onMouseEnter={() => {
          slidersHoverProps.onMouseEnter();
          chevronHoverProps.onMouseEnter();
        }}
        onMouseLeave={() => {
          slidersHoverProps.onMouseLeave();
          chevronHoverProps.onMouseLeave();
        }}
      >
        <SlidersHorizontalIcon ref={slidersRef} size={14} /> {t('grade.fineTune')}
        {active && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-label={t('grade.customised')} />}
        <ChevronDownIcon
          ref={chevronRef}
          size={16}
          className={cn('ml-auto transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="grid gap-4 px-3 pb-3 sm:grid-cols-[1fr_8rem]">
          <div className="space-y-4">
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
            <ColorBalanceBlock grade={grade} t={t} onSet={setBalance} />
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                {t('grade.curvesPreset')}
              </span>
              <Select value={grade?.curvesPreset ?? CURVES_NONE} onValueChange={setCurves}>
                <SelectTrigger aria-label={t('grade.curvesPreset')} className="w-full">
                  <SelectValue placeholder={t('grade.curvesNone')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CURVES_NONE}>{t('grade.curvesNone')}</SelectItem>
                  {CURVES_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {t(`grade.curves.${preset}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <PreviewSurface filter={gradeFilter(grade)} className="h-24 w-full sm:sticky sm:top-2 sm:self-start" />
        </div>
      )}
    </div>
  );
};

// Three-way color balance: one RGB slider row per tonal range. A collapsed disclosure so the six
// primary sliders stay the visual anchor of the panel.
const ColorBalanceBlock = ({
  grade,
  t,
  onSet,
}: {
  grade: Grade | undefined;
  t: TFunction<'admin'>;
  onSet: (range: ColorBalanceRange, channel: ColorChannel, value: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const active = grade?.colorBalance !== undefined;

  return (
    <div className="rounded-lg border border-foreground/10">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="tap flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        {t('grade.colorBalance')}
        {active && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-label={t('grade.customised')} />}
        <ChevronDownIcon size={16} className={cn('ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-3 px-3 pb-3">
          {COLOR_BALANCE_RANGES.map((range) => (
            <div key={range}>
              <span className="mb-1 block text-xs font-medium text-gray-500">{t(`grade.${range}`)}</span>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_CHANNELS.map((channel) => (
                  <RangeSlider
                    key={channel}
                    label={t(`grade.channel${channel.toUpperCase()}`)}
                    value={grade?.colorBalance?.[range]?.[channel] ?? 0}
                    min={-1}
                    max={1}
                    step={0.05}
                    resetTo={0}
                    onChange={(v) => {
                      onSet(range, channel, v);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
