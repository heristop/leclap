// Canvas-free placement controls shared by the (drag-canvas) OverlayPlacement panel and the canvas-less
// PlacementControls inspector: Position (X/Y) + Scale (W/H) numeric pairs, Opacity + Rotation sliders, and
// a reset-position/scale button. OverlayPlacementValue lives here (the subset of overlay fields these
// controls read/write) so both consumers depend on the single source. The owning PairField / AxisInput
// helpers live here too.
import { useTranslation } from 'react-i18next';
import { RotateCcw } from '@/presentation/components/icons';
import { parsePair, formatPair } from './animationOverlay';
import { RangeSlider } from './controls';

// The subset of overlay fields the shared placement controls read/write. Both AnimationOverlay and
// ImageOverlay carry these (string "x:y" position, string "w:h" scale, 0–1 opacity, degrees rotation).
export interface OverlayPlacementValue {
  position?: string;
  scale?: string;
  opacity?: number;
  rotation?: number;
}

interface PlacementFieldsProps {
  value: OverlayPlacementValue;
  onChange: (patch: OverlayPlacementValue) => void;
}

// Position/Scale/Opacity/Rotation + reset, with no canvas. The single source for the placement column.
export const PlacementFields = ({ value, onChange }: PlacementFieldsProps) => {
  const { t } = useTranslation('admin');

  return (
    <div className="min-w-[150px] flex-1 space-y-2">
      <PairField
        label={t('animation.position')}
        hint={t('animation.positionHint')}
        value={value.position}
        aLabel="X"
        bLabel="Y"
        placeholder="0"
        onChange={(position) => {
          onChange({ position });
        }}
      />
      <PairField
        label={t('animation.scale')}
        hint={t('animation.scaleHint')}
        value={value.scale}
        aLabel="W"
        bLabel="H"
        placeholder="auto"
        onChange={(scale) => {
          onChange({ scale });
        }}
      />
      <RangeSlider
        label={t('animation.opacity')}
        value={value.opacity ?? 1}
        min={0}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        resetTo={1}
        onChange={(opacity) => {
          onChange({ opacity });
        }}
      />
      <RangeSlider
        label={t('animation.rotation')}
        value={value.rotation ?? 0}
        min={-180}
        max={180}
        step={1}
        format={(v) => `${Math.round(v)}°`}
        resetTo={0}
        onChange={(rotation) => {
          onChange({ rotation });
        }}
      />
      {(value.position ?? value.scale) ? (
        <button
          type="button"
          onClick={() => {
            onChange({ position: undefined, scale: undefined });
          }}
          className="tap inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.65rem] font-semibold text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-300"
        >
          <RotateCcw className="size-3" aria-hidden />
          {t('animation.reset')}
        </button>
      ) : null}
    </div>
  );
};

interface PairFieldProps {
  label: string;
  hint: string;
  value: string | undefined;
  aLabel: string;
  bLabel: string;
  placeholder: string;
  onChange: (value: string | undefined) => void;
}

// Two numeric inputs that read/write a single "a:b" descriptor pair (Position X/Y or Scale W/H).
export const PairField = ({ label, hint, value, aLabel, bLabel, placeholder, onChange }: PairFieldProps) => {
  const [a, b] = parsePair(value);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        <span className="truncate text-[0.6rem] text-gray-400">{hint}</span>
      </div>
      <div className="flex gap-1.5">
        <AxisInput
          axis={aLabel}
          value={a}
          placeholder={placeholder}
          onChange={(v) => {
            onChange(formatPair(v, b));
          }}
        />
        <AxisInput
          axis={bLabel}
          value={b}
          placeholder={placeholder}
          onChange={(v) => {
            onChange(formatPair(a, v));
          }}
        />
      </div>
    </div>
  );
};

export const AxisInput = ({
  axis,
  value,
  placeholder,
  onChange,
}: {
  axis: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) => (
  <label className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/5 px-2 py-1 focus-within:border-brand-500/50">
    <span className="text-[0.65rem] font-semibold text-gray-400">{axis}</span>
    <input
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      aria-label={axis}
      onChange={(e) => {
        onChange(e.target.value.replace(/[^\d-]/g, ''));
      }}
      className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-gray-400"
    />
  </label>
);
