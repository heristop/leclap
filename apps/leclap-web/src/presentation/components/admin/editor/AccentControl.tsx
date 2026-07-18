// The shared "Accent" control — one on/off toggle + colour picker used by the title card, the lower
// third AND the positionable text overlays, so the accent UX is identical everywhere. `undefined`
// means no accent (no bar drawn); toggling on seeds the house default. The ColorPicker is the
// variable-aware one, so `{{ color }}` tokens work here like every other colour field.
//
// The optional `geometry` mode (text overlays only — title-card/lower-third bars are structural)
// adds the AccentBar knobs: position, length, thickness, align. Patches flow through
// normalizeAccent so defaults collapse back to the plain colour string and untouched descriptors
// stay byte-identical.
import { useTranslation } from 'react-i18next';
import { normalizeAccent, resolveAccentBar, type AccentBar } from '@leclap/creative-kit/editor';
import { Checkbox, ColorPicker, SegmentedControl } from '@/presentation/components/ui';
import { RangeSlider } from './controls';

export const DEFAULT_ACCENT = '#7C83FF';

// Geometry slider grid: length in whole/half em, thickness in hundredths — both grids include the
// defaults (6 / 0.12) so the reset targets collapse the field away.
const LENGTH_MIN = 1;
const LENGTH_MAX = 12;
const THICKNESS_MIN = 0.05;
const THICKNESS_MAX = 0.4;

// Discriminated props: without `geometry` the control only ever emits plain colour strings, so the
// structural call sites (title card, lower third) keep their narrow string-typed onChange.
type AccentControlProps = { hint?: string } & (
  | { geometry?: false; accent: string | undefined; onChange: (accent: string | undefined) => void }
  | {
      geometry: true;
      accent: string | AccentBar | undefined;
      onChange: (accent: string | AccentBar | undefined) => void;
    }
);

export const AccentControl = (props: AccentControlProps) => {
  const { t } = useTranslation('admin');
  const { accent, hint } = props;
  const on = accent !== undefined;
  const bar = accent === undefined ? undefined : resolveAccentBar(accent);

  const patch = (change: Partial<AccentBar>) => {
    if (bar === undefined) return;

    const next = normalizeAccent({ ...bar, ...change });

    if (props.geometry === true) {
      props.onChange(next);

      return;
    }

    // Structural accents stay plain colours; only the colour ever changes here.
    props.onChange(typeof next === 'string' ? next : next.color);
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400">{t('accent.label')}</span>
      <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <Checkbox
          checked={on}
          onCheckedChange={(c) => {
            props.onChange(c === true ? DEFAULT_ACCENT : undefined);
          }}
        />
        {t('accent.enable')}
      </label>
      {bar && (
        <ColorPicker
          aria-label={t('accent.color')}
          value={bar.color}
          onChange={(color) => {
            patch({ color });
          }}
        />
      )}
      {bar && props.geometry === true && <AccentGeometryFields bar={bar} onPatch={patch} />}
      <p className="text-xs text-gray-500 dark:text-gray-400">{hint ?? t('accent.hint')}</p>
    </div>
  );
};

// The two compact geometry rows: position + align pills, then the length/thickness em sliders.
const AccentGeometryFields = ({
  bar,
  onPatch,
}: {
  bar: Required<AccentBar>;
  onPatch: (change: Partial<AccentBar>) => void;
}) => {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('accent.position')}
          </span>
          <SegmentedControl
            ariaLabel={t('accent.position')}
            value={bar.position}
            options={[
              { value: 'below', label: t('accent.positionBelow') },
              { value: 'above', label: t('accent.positionAbove') },
            ]}
            onChange={(position) => {
              onPatch({ position: position as AccentBar['position'] });
            }}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('accent.align')}
          </span>
          <SegmentedControl
            ariaLabel={t('accent.align')}
            value={bar.align}
            options={[
              { value: 'left', label: t('accent.alignLeft') },
              { value: 'center', label: t('accent.alignCenter') },
              { value: 'right', label: t('accent.alignRight') },
            ]}
            onChange={(align) => {
              onPatch({ align: align as AccentBar['align'] });
            }}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <RangeSlider
          label={t('accent.length')}
          value={bar.length}
          min={LENGTH_MIN}
          max={LENGTH_MAX}
          step={0.5}
          format={(v) => `${v}×`}
          resetTo={6}
          onChange={(length) => {
            onPatch({ length });
          }}
        />
        <RangeSlider
          label={t('accent.thickness')}
          value={bar.thickness}
          min={THICKNESS_MIN}
          max={THICKNESS_MAX}
          step={0.01}
          format={(v) => `${v.toFixed(2)}×`}
          resetTo={0.12}
          onChange={(next) => {
            // The 0.01 step accumulates float noise (0.05 + 7*0.01 = 0.12000…01, which would dodge
            // the default collapse); re-quantise to the grid before patching.
            onPatch({ thickness: Math.round(next * 100) / 100 });
          }}
        />
      </div>
    </div>
  );
};
