// The x/y/w/h % inputs for an extra background layer. Each value is a 0..100 percent
// of the frame; the parent maps them to/from FFmpeg expressions. Compact 2×2 grid.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

type Axis = 'x' | 'y' | 'w' | 'h';

const FIELDS: Array<{ axis: Axis; label: string }> = [
  { axis: 'x', label: 'X' },
  { axis: 'y', label: 'Y' },
  { axis: 'w', label: 'W' },
  { axis: 'h', label: 'H' },
];

interface LayerGeometryProps {
  values: Record<Axis, number>;
  onChange: (axis: Axis, percent: number) => void;
}

export const LayerGeometryFields = ({ values, onChange }: LayerGeometryProps) => {
  const { t } = useTranslation('admin');

  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="mb-1 text-[0.65rem] font-semibold uppercase tracking-widest text-gray-400">
        {t('layer.position')}
      </legend>
      {FIELDS.map(({ axis, label }) => (
        <PercentField
          key={axis}
          label={label}
          value={values[axis]}
          onChange={(percent) => {
            onChange(axis, percent);
          }}
        />
      ))}
    </fieldset>
  );
};

const PercentField = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => {
  const id = useId();

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="w-3 text-[0.7rem] font-semibold text-gray-500">
        {label}
      </label>
      <div className="relative flex-1">
        <input
          id={id}
          type="number"
          min={0}
          max={100}
          value={Math.round(value)}
          onChange={(e) => {
            onChange(Math.min(100, Math.max(0, Number(e.target.value))));
          }}
          className="w-full rounded-lg border border-foreground/15 bg-surface-inset py-1.5 pl-2 pr-6 text-sm text-foreground transition-all focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
      </div>
    </div>
  );
};
