// Whole-video image watermark (descriptor global.watermark) — a still logo composited in one corner
// across every section, authored once. Mirrors the sibling global-layer fields (GlobalOverlaysField /
// WholeVideoAnimations): a collapsed SectionDisclosure whose summary reports the configured corner.
// The image picker reuses MediaPicker's library/upload/URL tabs; clearing the image clears the whole
// watermark (there is no watermark without an image).
import { useTranslation } from 'react-i18next';
import { WATERMARK_POSITIONS } from 'ffmpeg-video-composer/src/schemas/global.schemas.ts';
import type { EditorState, WatermarkChoice, WatermarkPosition } from '../templateEditorModel';
import { MediaPicker } from '../MediaPicker';
import { RangeSlider, SegmentedControl } from './controls';
import { SectionDisclosure } from './SectionDisclosure';

// Engine defaults (global.schemas.ts WatermarkSchema) — the sliders' reset targets and the values
// applied while the author never touches a control.
const DEFAULT_POSITION: WatermarkPosition = 'bottom-right';
const DEFAULT_SCALE = 0.12;
const DEFAULT_OPACITY = 0.8;
const DEFAULT_MARGIN = 24;

interface GlobalWatermarkFieldProps {
  watermark: WatermarkChoice | undefined;
  patch: (p: Partial<EditorState>) => void;
}

export const GlobalWatermarkField = ({ watermark, patch }: GlobalWatermarkFieldProps) => {
  const { t } = useTranslation('admin');
  const position = watermark?.position ?? DEFAULT_POSITION;
  const summary = watermark ? t(`watermark.pos.${position}`) : t('summaryChip.none');

  const update = (next: Partial<WatermarkChoice>) => {
    if (!watermark) return;

    patch({ watermark: { ...watermark, ...next } });
  };

  return (
    <SectionDisclosure label={t('watermark.label')} summary={summary}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('watermark.hint')}</p>
      <MediaPicker
        kind="picture"
        allowUpload
        value={watermark?.image ?? null}
        onChange={(choice) => {
          if (!choice) {
            patch({ watermark: undefined });

            return;
          }

          patch({ watermark: watermark ? { ...watermark, image: choice } : { image: choice } });
        }}
      />
      {watermark && (
        <>
          <SegmentedControl
            label={t('watermark.position')}
            value={position}
            options={WATERMARK_POSITIONS.map((pos) => ({ value: pos, label: t(`watermark.pos.${pos}`) }))}
            onChange={(next) => {
              update({ position: next });
            }}
          />
          <RangeSlider
            label={t('watermark.scale')}
            value={watermark.scale ?? DEFAULT_SCALE}
            min={0.02}
            max={0.5}
            step={0.01}
            resetTo={DEFAULT_SCALE}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(scale) => {
              update({ scale });
            }}
          />
          <RangeSlider
            label={t('watermark.opacity')}
            value={watermark.opacity ?? DEFAULT_OPACITY}
            min={0}
            max={1}
            step={0.05}
            resetTo={DEFAULT_OPACITY}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(opacity) => {
              update({ opacity });
            }}
          />
          <RangeSlider
            label={t('watermark.margin')}
            value={watermark.margin ?? DEFAULT_MARGIN}
            min={0}
            max={200}
            step={1}
            resetTo={DEFAULT_MARGIN}
            format={(v) => `${v}px`}
            onChange={(margin) => {
              update({ margin });
            }}
          />
        </>
      )}
    </SectionDisclosure>
  );
};
