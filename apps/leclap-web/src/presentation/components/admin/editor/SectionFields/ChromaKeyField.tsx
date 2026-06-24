// The "Background removal" control for project_video sections: an enable toggle, the screen colour to
// key out, a similarity slider (how aggressively to key) and the solid colour painted behind the clip.
// Lowers to the descriptor `chromaKey` sugar, which the engine turns into a colorkey + overlay graph.
// Disabling clears the whole object.
import { useTranslation } from 'react-i18next';
import type { ChromaKey } from '../../templateEditorModel';
import { Checkbox, ColorPicker } from '@/presentation/components/ui';
import { RangeSlider } from '../controls';

const DEFAULT_KEY_COLOR = '#00FF00';
const DEFAULT_BACKGROUND = '#000000';
const DEFAULT_SIMILARITY = 0.3;

interface ChromaKeyFieldProps {
  chromaKey: ChromaKey | undefined;
  onChange: (chromaKey: ChromaKey | undefined) => void;
}

export const ChromaKeyField = ({ chromaKey, onChange }: ChromaKeyFieldProps) => {
  const { t } = useTranslation('admin');
  const enabled = Boolean(chromaKey);

  const patch = (next: Partial<ChromaKey>) => {
    onChange({ color: DEFAULT_KEY_COLOR, ...chromaKey, ...next });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('chromaKey.hint')}</p>
      <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <Checkbox
          checked={enabled}
          onCheckedChange={(c) => {
            onChange(c === true ? { color: DEFAULT_KEY_COLOR } : undefined);
          }}
        />
        {t('chromaKey.enable')}
      </label>

      {enabled && chromaKey && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                {t('chromaKey.keyColor')}
              </span>
              <ColorPicker
                aria-label={t('chromaKey.keyColor')}
                value={chromaKey.color}
                onChange={(color) => {
                  patch({ color });
                }}
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                {t('chromaKey.background')}
              </span>
              <ColorPicker
                aria-label={t('chromaKey.background')}
                value={chromaKey.background ?? DEFAULT_BACKGROUND}
                onChange={(background) => {
                  patch({ background });
                }}
              />
            </div>
          </div>
          <RangeSlider
            label={t('chromaKey.similarity')}
            value={chromaKey.similarity ?? DEFAULT_SIMILARITY}
            min={0.01}
            max={1}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(similarity) => {
              patch({ similarity });
            }}
          />
        </div>
      )}
    </div>
  );
};
