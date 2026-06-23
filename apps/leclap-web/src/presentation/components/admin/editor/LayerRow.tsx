// One row of the LayersEditor: colour + opacity, an optional gradient (second colour +
// direction), the % geometry box for extra layers, and reorder/remove controls. The
// base (first) layer is full-bleed, so it shows no geometry and cannot be removed/moved.
import { Trash2 } from '@/presentation/components/icons';
import { ChevronUpIcon } from '@/presentation/components/icons/chevron-up';
import { ChevronDownIcon } from '@/presentation/components/icons/chevron-down';
import { useTranslation } from 'react-i18next';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import type { TFunction } from 'i18next';
import { Checkbox, ColorPicker } from '@/presentation/components/ui';
import { cn } from '@/lib/utils';
import type { BackgroundLayer } from '../templateEditorModel';
import { RangeSlider, SegmentedControl } from './controls';
import { percentToExpr, exprToPercent } from './layerGeometry';
import { LayerGeometryFields } from './LayerGeometryFields';

const moveBtn = (enabled: boolean): string =>
  cn(
    'tap rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
    enabled ? 'text-gray-500 hover:text-brand-500' : 'pointer-events-none opacity-30'
  );

interface LayerRowProps {
  layer: BackgroundLayer;
  index: number;
  isBase: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (patch: Partial<BackgroundLayer>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

const DIRECTIONS = [
  { value: 'horizontal' as const, label: '↔' },
  { value: 'vertical' as const, label: '↕' },
  { value: 'diagonal' as const, label: '⤢' },
];

export const LayerRow = ({
  layer,
  index,
  isBase,
  canMoveUp,
  canMoveDown,
  onPatch,
  onMove,
  onRemove,
}: LayerRowProps) => {
  const { t } = useTranslation('admin');
  const layerName = isBase ? t('layer.base') : t('layer.name', { index });
  const { ref: chevronUpRef, hoverProps: chevronUpHoverProps } = useIconHover();
  const { ref: chevronDownRef, hoverProps: chevronDownHoverProps } = useIconHover();

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface p-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-xs font-semibold text-gray-500">{layerName}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            aria-label={t('layer.moveUp')}
            disabled={!canMoveUp}
            onClick={() => {
              onMove(-1);
            }}
            className={moveBtn(canMoveUp)}
            {...chevronUpHoverProps}
          >
            <ChevronUpIcon ref={chevronUpRef} size={16} />
          </button>
          <button
            type="button"
            aria-label={t('layer.moveDown')}
            disabled={!canMoveDown}
            onClick={() => {
              onMove(1);
            }}
            className={moveBtn(canMoveDown)}
            {...chevronDownHoverProps}
          >
            <ChevronDownIcon ref={chevronDownRef} size={16} />
          </button>
          {!isBase && (
            <button
              type="button"
              aria-label={t('layer.remove')}
              onClick={onRemove}
              className="tap rounded-md p-1 text-gray-500 transition-colors hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <GradientToggle layer={layer} t={t} onPatch={onPatch} />
        {layer.gradient ? (
          <GradientFields layer={layer} t={t} onPatch={onPatch} />
        ) : (
          <ColorPicker
            aria-label={t('layer.color', { name: layerName })}
            value={layer.color ?? '#000000'}
            onChange={(color) => {
              onPatch({ color });
            }}
          />
        )}
        <RangeSlider
          label={t('layer.opacity')}
          value={layer.opacity ?? 1}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(opacity) => {
            onPatch({ opacity });
          }}
        />
        {!isBase && (
          <LayerGeometryFields
            values={{
              x: exprToPercent(layer.x, 25),
              y: exprToPercent(layer.y, 25),
              w: exprToPercent(layer.w, 50),
              h: exprToPercent(layer.h, 50),
            }}
            onChange={(axis, percent) => {
              onPatch({ [axis]: percentToExpr(axis, percent) });
            }}
          />
        )}
      </div>
    </div>
  );
};

const GradientToggle = ({
  layer,
  t,
  onPatch,
}: {
  layer: BackgroundLayer;
  t: TFunction<'admin'>;
  onPatch: (p: Partial<BackgroundLayer>) => void;
}) => (
  <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
    <Checkbox
      checked={Boolean(layer.gradient)}
      onCheckedChange={(c) => {
        onPatch({
          gradient: c === true ? { from: layer.color ?? '#7C83FD', to: '#000000', direction: 'vertical' } : undefined,
        });
      }}
    />
    {t('layer.gradient')}
  </label>
);

const GradientFields = ({
  layer,
  t,
  onPatch,
}: {
  layer: BackgroundLayer;
  t: TFunction<'admin'>;
  onPatch: (p: Partial<BackgroundLayer>) => void;
}) => {
  const gradient = layer.gradient;

  if (!gradient) return null;

  return (
    <div className="space-y-2 rounded-lg border border-foreground/10 bg-surface p-2">
      <ColorPicker
        aria-label={t('layer.gradientStart')}
        value={gradient.from}
        onChange={(from) => {
          onPatch({ gradient: { ...gradient, from } });
        }}
      />
      <ColorPicker
        aria-label={t('layer.gradientEnd')}
        value={gradient.to}
        onChange={(to) => {
          onPatch({ gradient: { ...gradient, to } });
        }}
      />
      <SegmentedControl
        label={t('layer.direction')}
        value={gradient.direction ?? 'vertical'}
        options={DIRECTIONS}
        onChange={(direction) => {
          onPatch({ gradient: { ...gradient, direction } });
        }}
      />
    </div>
  );
};
