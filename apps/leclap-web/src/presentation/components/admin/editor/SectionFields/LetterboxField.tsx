// Cinemascope-style letterbox bars: an enable toggle, the target aspect ratio (drawn as the
// simulated width:height, e.g. "2.39:1"), and an optional bar colour (default black). Lowers to the
// descriptor `letterbox` sugar (registry.ts draws two drawboxes over the graded image). Mirrors the
// ChromaKeyField pattern: disabling clears the whole object.
import { useTranslation } from 'react-i18next';
import type { Letterbox } from '../../templateEditorModel';
import { Checkbox, ColorPicker } from '@/presentation/components/ui';
import { RangeSlider } from '../controls';

const DEFAULT_ASPECT = 2.39;
const DEFAULT_COLOR = '#000000';

interface LetterboxFieldProps {
  letterbox: Letterbox | undefined;
  onChange: (letterbox: Letterbox | undefined) => void;
}

export const LetterboxField = ({ letterbox, onChange }: LetterboxFieldProps) => {
  const { t } = useTranslation('admin');
  const enabled = Boolean(letterbox);

  const patch = (next: Partial<Letterbox>) => {
    onChange({ aspect: DEFAULT_ASPECT, ...letterbox, ...next });
  };

  return (
    <div className="space-y-3">
      <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <Checkbox
          checked={enabled}
          onCheckedChange={(c) => {
            onChange(c === true ? { aspect: DEFAULT_ASPECT } : undefined);
          }}
        />
        {t('letterbox.enable')}
      </label>

      {enabled && letterbox && (
        <div className="space-y-3">
          <RangeSlider
            label={t('letterbox.aspect')}
            value={letterbox.aspect}
            min={1}
            max={4}
            step={0.01}
            format={(v) => `${v.toFixed(2)}:1`}
            resetTo={DEFAULT_ASPECT}
            onChange={(aspect) => {
              patch({ aspect });
            }}
          />
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              {t('letterbox.color')}
            </span>
            <ColorPicker
              aria-label={t('letterbox.color')}
              value={letterbox.color ?? DEFAULT_COLOR}
              onChange={(color) => {
                patch({ color });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
