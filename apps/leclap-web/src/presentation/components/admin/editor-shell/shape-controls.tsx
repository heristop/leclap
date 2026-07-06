// Inspector controls for a shape element (an ImageOverlay carrying a `shape` recipe): geometry
// toggle (rectangle/circle), fill colour, corner-radius preset chips (rectangles), and an inside
// outline (width chips + colour). Every recipe change re-rasterizes the overlay's PNG at its
// current scale box (regeneratedShapePatch) so the descriptor's data: URL always matches the
// recipe. Placement (position/scale/opacity/rotation) stays with the shared PlacementFields.
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ColorPicker } from '@/presentation/components/ui';
import { RangeSlider, SegmentedControl } from '../editor/controls';
import type { ImageOverlay, Orientation, ShapeSpec } from '../templateEditorModel';
import { regeneratedShapePatch, shapeTargetBox } from './shape-image';

// Preset pixel chips (output px): a curated ladder for the outline width.
const STROKE_PRESETS = [0, 4, 8, 16] as const;

// Default outline colour when the width is set before the colour.
const DEFAULT_STROKE_COLOR = '#ffffff';

interface ShapeControlsProps {
  value: ImageOverlay;
  shape: ShapeSpec;
  orientation: Orientation;
  onChange: (patch: Partial<ImageOverlay>) => void;
}

export const ShapeControls = ({ value, shape, orientation, onChange }: ShapeControlsProps) => {
  const { t } = useTranslation('admin');

  // Merge a recipe change, dropping cleared (undefined) keys so the emitted descriptor stays
  // minimal, and re-rasterize the PNG alongside it.
  const patchShape = (patch: Partial<ShapeSpec>) => {
    const merged = { ...shape, ...patch };
    // entries typed as non-undefined, but a Partial patch can set a key to undefined to clear it.
    const entries = Object.entries(merged) as Array<[string, unknown]>;
    const next = Object.fromEntries(entries.filter(([, v]) => v !== undefined)) as ShapeSpec;

    onChange(regeneratedShapePatch(value, next, orientation));
  };

  // Cap the radius at half the shape's current short edge — that value is a full pill/circle, and the
  // rasterizer clamps anything larger anyway, so the slider top always means "as round as it gets".
  const box = shapeTargetBox(value.scale, orientation);
  const cornerMax = Math.round(Math.min(box.w, box.h) / 2);

  return (
    <div className="space-y-3">
      <SegmentedControl<ShapeSpec['kind']>
        label={t('shape.kind')}
        value={shape.kind}
        options={[
          { value: 'rect', label: t('shape.rect') },
          { value: 'ellipse', label: t('shape.ellipse') },
        ]}
        onChange={(kind) => {
          patchShape({ kind });
        }}
      />
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t('shape.fill')}
        </label>
        <ColorPicker
          aria-label={t('shape.fill')}
          value={shape.color}
          onChange={(color) => {
            patchShape({ color });
          }}
        />
      </div>
      {shape.kind === 'rect' && (
        <div>
          <RangeSlider
            label={t('shape.cornerRadius')}
            value={shape.cornerRadius ?? 0}
            min={0}
            max={cornerMax}
            step={2}
            format={(v) => `${v}px`}
            resetTo={0}
            onChange={(cornerRadius) => {
              patchShape({ cornerRadius: cornerRadius === 0 ? undefined : cornerRadius });
            }}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('shape.cornerRadiusHint')}</p>
        </div>
      )}
      <PresetChips
        label={t('shape.stroke')}
        hint={t('shape.strokeHint')}
        value={shape.strokeWidth ?? 0}
        presets={STROKE_PRESETS}
        t={t}
        onChange={(strokeWidth) => {
          // Clearing the width also clears the colour so the recipe collapses back to a plain fill.
          if (strokeWidth === 0) {
            patchShape({ strokeWidth: undefined, strokeColor: undefined });

            return;
          }

          patchShape({ strokeWidth, strokeColor: shape.strokeColor ?? DEFAULT_STROKE_COLOR });
        }}
      />
      {(shape.strokeWidth ?? 0) > 0 && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('shape.strokeColor')}
          </label>
          <ColorPicker
            aria-label={t('shape.strokeColor')}
            value={shape.strokeColor ?? DEFAULT_STROKE_COLOR}
            onChange={(strokeColor) => {
              patchShape({ strokeColor });
            }}
          />
        </div>
      )}
    </div>
  );
};

// A none/px-ladder segmented control for a pixel knob, with a one-line hint. An off-ladder stored
// value (a hand-authored descriptor) simply highlights nothing until a chip is picked.
const PresetChips = ({
  label,
  hint,
  value,
  presets,
  t,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  presets: ReadonlyArray<number>;
  t: TFunction<'admin'>;
  onChange: (px: number) => void;
}) => (
  <div>
    <SegmentedControl<string>
      label={label}
      value={String(value)}
      options={presets.map((px) => ({
        value: String(px),
        label: px === 0 ? t('shape.none') : `${px}px`,
      }))}
      onChange={(px) => {
        onChange(Number(px));
      }}
    />
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
  </div>
);
