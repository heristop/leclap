// The shared "Accent" control — one on/off toggle + colour picker used by the title card, the lower
// third AND the positionable text overlays, so the accent UX is identical everywhere. `undefined`
// means no accent (no bar drawn); toggling on seeds the house default. The ColorPicker is the
// variable-aware one, so `{{ color }}` tokens work here like every other colour field.
import { useTranslation } from 'react-i18next';
import { Checkbox, ColorPicker } from '@/presentation/components/ui';

export const DEFAULT_ACCENT = '#7C83FF';

interface AccentControlProps {
  accent: string | undefined;
  onChange: (accent: string | undefined) => void;
  /** One-line semantics hint below the toggle; defaults to the generic underline-bar wording. */
  hint?: string;
}

export const AccentControl = ({ accent, onChange, hint }: AccentControlProps) => {
  const { t } = useTranslation('admin');
  const on = accent !== undefined;

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400">{t('accent.label')}</span>
      <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <Checkbox
          checked={on}
          onCheckedChange={(c) => {
            onChange(c === true ? DEFAULT_ACCENT : undefined);
          }}
        />
        {t('accent.enable')}
      </label>
      {on && (
        <ColorPicker
          aria-label={t('accent.color')}
          value={accent}
          onChange={(color) => {
            onChange(color);
          }}
        />
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">{hint ?? t('accent.hint')}</p>
    </div>
  );
};
