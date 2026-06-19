// Ordered background-layer stack for color sections, replacing the single color
// picker. The first layer is the full-bleed base; extra layers sit on top with their
// own colour/opacity/gradient and a % geometry box. Writes patchLayers(state, i, layers).
import { Plus } from '@/presentation/components/icons';
import { useTranslation } from 'react-i18next';
import type { BackgroundLayer } from '../templateEditorModel';
import { newBaseLayer, newExtraLayer } from './layerGeometry';
import { LayerRow } from './LayerRow';

interface LayersEditorProps {
  /** The section's layers; when empty the base falls back to `baseColor`. */
  layers: BackgroundLayer[] | undefined;
  baseColor: string;
  onChange: (layers: BackgroundLayer[]) => void;
}

export const LayersEditor = ({ layers, baseColor, onChange }: LayersEditorProps) => {
  const { t } = useTranslation('admin');
  const list = layers && layers.length > 0 ? layers : [newBaseLayer(baseColor)];

  const update = (index: number, patch: Partial<BackgroundLayer>) => {
    onChange(list.map((layer, i) => (i === index ? { ...layer, ...patch } : layer)));
  };

  const move = (index: number, delta: number) => {
    const to = index + delta;

    if (to < 1 || to >= list.length) return;

    const next = [...list];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  return (
    <div className="sm:col-span-2">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('layer.background')}
      </span>
      <div className="space-y-2">
        {list.map((layer, index) => (
          <LayerRow
            key={index}
            layer={layer}
            index={index}
            isBase={index === 0}
            canMoveUp={index > 1}
            canMoveDown={index > 0 && index < list.length - 1}
            onPatch={(patch) => {
              update(index, patch);
            }}
            onMove={(delta) => {
              move(index, delta);
            }}
            onRemove={() => {
              onChange(list.filter((_, i) => i !== index));
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            onChange([...list, newExtraLayer()]);
          }}
          className="tap inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] dark:text-gray-300"
        >
          <Plus className="h-3.5 w-3.5" /> {t('layer.add')}
        </button>
      </div>
    </div>
  );
};
