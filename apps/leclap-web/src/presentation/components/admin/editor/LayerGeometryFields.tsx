// The x/y/w/h % inputs for an extra background layer. Each value is a 0..100 percent
// of the frame; the parent maps them to/from FFmpeg expressions. Compact 2×2 grid.
import { useTranslation } from 'react-i18next';
import { NumberField } from '@/presentation/components/ui/NumberField';

type Axis = 'x' | 'y' | 'w' | 'h';

const AXES: Axis[] = ['x', 'y', 'w', 'h'];

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
      {AXES.map((axis) => {
        const label = t(`layer.axis.${axis}`);

        return (
          <div key={axis} className="flex items-center gap-1.5">
            <span className="w-3 text-[0.7rem] font-semibold text-gray-500">{label}</span>
            <NumberField
              aria-label={label}
              value={Math.round(values[axis])}
              min={0}
              max={100}
              step={1}
              unit="%"
              compact
              className="flex-1"
              onChange={(percent) => {
                onChange(axis, percent);
              }}
            />
          </div>
        );
      })}
    </fieldset>
  );
};
