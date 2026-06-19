import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { useObjectUrl } from './useObjectUrl';

interface RushThumbProps {
  file: File;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

// A single take cell: a poster frame, a radio-like selected ring/check, a "Take N" label, and a
// remove (×) control. Selecting makes this the take the editor/preview/render use.
const RushThumb = ({ file, index, selected, onSelect, onRemove }: RushThumbProps) => {
  const { t } = useTranslation('builder');
  const url = useObjectUrl(file);
  const label = t('rush.take', { number: index + 1 });

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={t('rush.use', { number: index + 1 })}
        className={cn(
          'group relative block aspect-[3/4] w-20 overflow-hidden rounded-lg bg-surface-2 ring-2 transition-colors focus-visible:outline-none focus-visible:ring-brand-500',
          selected ? 'ring-brand-500' : 'ring-foreground/10 hover:ring-foreground/30'
        )}
      >
        {url ? (
          <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-[0.6rem] text-muted-foreground">{label}</span>
        )}
        {selected && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-brand-500 text-white shadow"
          >
            <Check className="size-3" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-left text-[0.62rem] font-semibold text-white">
          {label}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('rush.remove', { number: index + 1 })}
        className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-surface-2 text-muted-foreground shadow ring-1 ring-foreground/10 transition-colors hover:bg-error/15 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <X className="size-3" />
      </button>
    </div>
  );
};

interface RushChooserProps {
  rushes: File[];
  selectedRush: File | undefined;
  onSelectRush: (file: File) => void;
  onRemoveRush: (file: File) => void;
}

// The take gallery: a horizontal row of candidate takes for a section. Only worth showing once there
// is more than one take to choose between. A removal that empties the gallery never reaches here, so
// the parent re-hides it.
export const RushChooser = ({ rushes, selectedRush, onSelectRush, onRemoveRush }: RushChooserProps) => {
  const { t } = useTranslation('builder');
  // A stable key per File so React keeps each thumb's video element across reorders/removals.
  const [keys] = useState(() => new WeakMap<File, string>());
  const keyFor = (file: File, i: number): string => {
    const existing = keys.get(file);

    if (existing) return existing;

    const next = `${i}-${file.name}-${file.lastModified}`;
    keys.set(file, next);

    return next;
  };

  if (rushes.length <= 1) return null;

  return (
    <section aria-label={t('rush.gallery')} className="space-y-2">
      <h4 className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t('rush.gallery')}
      </h4>
      <div className="flex items-start gap-2 overflow-x-auto pb-1 pt-1.5 [scrollbar-width:thin]">
        {rushes.map((file, i) => (
          <RushThumb
            key={keyFor(file, i)}
            file={file}
            index={i}
            selected={file === selectedRush}
            onSelect={() => {
              onSelectRush(file);
            }}
            onRemove={() => {
              onRemoveRush(file);
            }}
          />
        ))}
      </div>
    </section>
  );
};
