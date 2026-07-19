// Inspector controls for a rounded-panel backdrop element (an ImageOverlay whose choice url is a
// `panel:` scheme, see panel-backdrop-logic.ts): radius and opacity sliders plus a fill colour picker.
// Width/height are NOT exposed here — the panel's box comes from the template's layout (the same box
// the placement fields' scale already carries), so the only author knobs are the rounded-rect recipe
// the engine reads out of the url at compile time.
import { useTranslation } from 'react-i18next';
import { ColorPicker } from '@/presentation/components/ui';
import { RangeSlider } from '../editor/controls';
import type { PanelSpec } from '@leclap/creative-kit/editor';
import type { ImageOverlay } from '../templateEditorModel';
import { regeneratedPanelPatch } from './panel-backdrop-logic';

interface PanelBackdropControlsProps {
  spec: PanelSpec;
  onChange: (patch: Partial<ImageOverlay>) => void;
}

export const PanelBackdropControls = ({ spec, onChange }: PanelBackdropControlsProps) => {
  const { t } = useTranslation('admin');
  // A radius past half the shorter edge is a no-op (the engine clamps it to a pill/capsule), so the
  // slider's top always means "as round as it gets" — same convention as the shape element's radius.
  const maxRadius = Math.floor(Math.min(spec.width, spec.height) / 2);

  const patchSpec = (patch: Partial<PanelSpec>) => {
    onChange(regeneratedPanelPatch(spec, patch));
  };

  return (
    <div className="space-y-3">
      <RangeSlider
        label={t('panel.radius')}
        value={spec.radius}
        min={0}
        max={maxRadius}
        step={1}
        format={(v) => `${v}px`}
        onChange={(radius) => {
          patchSpec({ radius });
        }}
      />
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t('panel.color')}
        </label>
        <ColorPicker
          aria-label={t('panel.color')}
          value={`#${spec.color}`}
          onChange={(hex) => {
            patchSpec({ color: hex.startsWith('#') ? hex.slice(1) : hex });
          }}
        />
      </div>
      <RangeSlider
        label={t('panel.opacity')}
        value={spec.opacity}
        min={0}
        max={1}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(opacity) => {
          patchSpec({ opacity });
        }}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('panel.hint')}</p>
    </div>
  );
};
