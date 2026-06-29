// The "Lower third" control for project_video sections: a title / subtitle band over the clip with an
// accent, an optional right-aligned badge, a band opacity, a position and an entrance. Lowers to the
// descriptor `lowerThird` sugar (the engine composites it on top of any animation overlay). Clearing
// title, subtitle and badge removes the band.
import { useTranslation } from 'react-i18next';
import type { LowerThird } from '../../templateEditorModel';
import { ColorPicker } from '@/presentation/components/ui';
import { SegmentedControl, RangeSlider, type SegmentOption } from '../controls';
import { RevealControl } from '../RevealControl';
import { TextEffectControl } from '../TextEffectControl';
import { VariableTextField } from '../VariableTextField';

const DEFAULT_ACCENT = '#7C83FF';
const DEFAULT_BAND_OPACITY = 0.6;
type Position = NonNullable<LowerThird['position']>;

function lineText(line: LowerThird['title']): string {
  return line?.en ?? '';
}

function hasAnyText(band: LowerThird): boolean {
  return [band.title, band.subtitle, band.badge].some((line) => lineText(line).trim() !== '');
}

function nextLowerThird(current: LowerThird | undefined, patch: Partial<LowerThird>): LowerThird | undefined {
  const merged: LowerThird = { ...current, ...patch };

  return hasAnyText(merged) ? merged : undefined;
}

function setLine(value: string): LowerThird['title'] | undefined {
  return value.trim() === '' ? undefined : { en: value };
}

interface LowerThirdFieldProps {
  lowerThird: LowerThird | undefined;
  onChange: (lowerThird: LowerThird | undefined) => void;
  variables: string[];
  inputCls: string;
}

export const LowerThirdField = ({ lowerThird, onChange, variables, inputCls }: LowerThirdFieldProps) => {
  const { t } = useTranslation('admin');
  const band = lowerThird;
  const position = band?.position ?? 'bottom';

  const positionOptions: ReadonlyArray<SegmentOption<Position>> = [
    { value: 'bottom', label: t('lowerThird.bottom') },
    { value: 'top', label: t('lowerThird.top') },
  ];

  const patch = (next: Partial<LowerThird>) => {
    onChange(nextLowerThird(band, next));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('lowerThird.hint')}</p>
      <Line
        label={t('lowerThird.title')}
        placeholder={t('lowerThird.titlePlaceholder')}
        value={lineText(band?.title)}
        variables={variables}
        inputCls={inputCls}
        onChange={(v) => {
          patch({ title: setLine(v) });
        }}
      />
      <Line
        label={t('lowerThird.subtitle')}
        placeholder={t('lowerThird.subtitlePlaceholder')}
        value={lineText(band?.subtitle)}
        variables={variables}
        inputCls={inputCls}
        onChange={(v) => {
          patch({ subtitle: setLine(v) });
        }}
      />
      <Line
        label={t('lowerThird.badge')}
        placeholder={t('lowerThird.badgePlaceholder')}
        value={lineText(band?.badge)}
        variables={variables}
        inputCls={inputCls}
        onChange={(v) => {
          patch({ badge: setLine(v) });
        }}
      />
      {band && hasAnyText(band) && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                {t('lowerThird.accent')}
              </span>
              <ColorPicker
                aria-label={t('lowerThird.accent')}
                value={band.accent ?? DEFAULT_ACCENT}
                onChange={(accent) => {
                  patch({ accent });
                }}
              />
            </div>
            <SegmentedControl
              label={t('lowerThird.position')}
              value={position}
              options={positionOptions}
              onChange={(next) => {
                patch({ position: next });
              }}
            />
          </div>
          <RangeSlider
            label={t('lowerThird.band')}
            value={band.boxOpacity ?? DEFAULT_BAND_OPACITY}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(boxOpacity) => {
              patch({ boxOpacity });
            }}
          />
          <RevealControl
            reveal={band.reveal}
            onChange={(reveal) => {
              patch({ reveal });
            }}
          />
          <TextEffectControl
            effect={band.effect}
            onChange={(effect) => {
              patch({ effect });
            }}
          />
        </>
      )}
    </div>
  );
};

// Backed by VariableTextField so typing `#` opens the in-scope variable autocomplete and stores the
// canonical `{{ name }}` token.
const Line = ({
  label,
  placeholder,
  value,
  variables,
  inputCls,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  variables: string[];
  inputCls: string;
  onChange: (value: string) => void;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
    <VariableTextField
      value={value}
      onChange={onChange}
      variables={variables.map((name) => ({ name, scope: 'global' as const }))}
      placeholder={placeholder}
      className={inputCls}
      aria-label={label}
    />
  </label>
);
