import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Loader2 } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/relativeTime';

// Defined here (not in Builder.tsx) so both the persistence hook and the shell can import it without
// a render-cycle dependency.
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt: number | null;
}

const shellClass = 'ml-1 hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex';

// Surfaces the builder's silent auto-save in the top bar: a spinner while saving, a check (with a
// freshening "x ago") once saved, and a warning if a save fails. Idle renders nothing.
export const SaveStatusIndicator = ({ status, lastSavedAt }: SaveStatusIndicatorProps) => {
  const { t } = useTranslation('builder');
  // Re-tick on a light interval so the relative "saved 2m ago" label stays fresh without a save.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const handle = setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => {
      clearInterval(handle);
    };
  }, []);

  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <span className={shellClass} aria-live="polite">
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {t('editor.save.saving')}
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className={cn(shellClass, 'text-warning')} aria-live="polite">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        {t('editor.save.failed')}
      </span>
    );
  }

  if (lastSavedAt === null) {
    return (
      <span className={shellClass} aria-live="polite">
        <Check className="size-3.5 text-brand-500" aria-hidden="true" />
        {t('editor.save.saved')}
      </span>
    );
  }

  const elapsed = relativeTime(lastSavedAt, now);
  const time = t(`editor.save.time.${elapsed.key}`, { count: elapsed.count });

  return (
    <span className={shellClass} aria-live="polite">
      <Check className="size-3.5 text-brand-500" aria-hidden="true" />
      {t('editor.save.savedAgo', { time })}
    </span>
  );
};
