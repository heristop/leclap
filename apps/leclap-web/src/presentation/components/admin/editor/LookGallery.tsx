// Horizontal strip of look presets. Each card shows the sample frame with the look
// approximated via CSS filters, so the author picks by eye. "None" leads. Writes
// section.look (cleared to undefined for "None").
import { LOOK_PRESETS } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { lookFilter } from './lookFilters';
import { PreviewSurface } from './PreviewSurface';

interface LookGalleryProps {
  /** Current look name, or undefined for none. */
  look: string | undefined;
  onChange: (look: string | undefined) => void;
}

export const LookGallery = ({ look, onChange }: LookGalleryProps) => {
  const { t } = useTranslation('admin');

  const options: Array<{ value: string | undefined; label: string }> = [
    { value: undefined, label: t('look.none') },
    ...LOOK_PRESETS.map((name) => ({ value: name as string | undefined, label: name })),
  ];

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
        {t('look.label')}
      </span>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label={t('look.preset')}>
        {options.map((option) => (
          <LookCard
            key={option.label}
            label={option.label}
            filter={lookFilter(option.value)}
            active={(look ?? undefined) === option.value}
            onSelect={() => {
              onChange(option.value);
            }}
          />
        ))}
      </div>
    </div>
  );
};

interface LookCardProps {
  label: string;
  filter: string;
  active: boolean;
  onSelect: () => void;
}

const LookCard = ({ label, filter, active, onSelect }: LookCardProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    onClick={onSelect}
    className={cn(
      'shrink-0 rounded-xl border p-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
      active
        ? 'border-brand-500 bg-brand-500/10'
        : 'border-foreground/10 hover:border-brand-500/40 hover:bg-foreground/5'
    )}
  >
    <PreviewSurface filter={filter} className="h-16 w-24" />
    <span
      className={cn(
        'mt-1 block text-center text-[0.65rem] font-semibold capitalize',
        active ? 'text-brand-600 dark:text-brand-300' : 'text-gray-500'
      )}
    >
      {label}
    </span>
  </button>
);
