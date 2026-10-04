// The ready state: what was generated, at a glance — name, one-line description, scene and clip
// counts, length and format, and the effects it uses — plus any warnings from the run.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { DescriptorSummary } from '@/application/usecases/ai-template/descriptor-summary';
import { Info } from '@/presentation/components/icons';

interface ResultCardProps {
  summary: DescriptorSummary;
  warnings: string[];
}

const FACT = 'rounded-md bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium tabular-nums text-foreground/90';

export const ResultCard = ({ summary, warnings }: ResultCardProps) => {
  const { t } = useTranslation('ai');
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const seconds = Number(summary.durationSeconds.toFixed(1));

  // Bring the result into view when it arrives — the form above it may have been scrolled away.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [reduced]);

  return (
    <section
      ref={ref}
      aria-labelledby="ai-result-name"
      className="grid scroll-mb-48 gap-3 rounded-xl border border-divider bg-surface-2 p-4"
    >
      <div>
        <h3 id="ai-result-name" className="text-base font-semibold text-foreground">
          {summary.name || t('title')}
        </h3>
        {summary.description && (
          <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{summary.description}</p>
        )}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        <li className={FACT}>{t('result.scenes', { count: summary.scenes })}</li>
        {summary.footageScenes > 0 && <li className={FACT}>{t('result.footage', { count: summary.footageScenes })}</li>}
        <li className={FACT}>
          {summary.durationIsEstimate ? t('result.durationEstimate', { seconds }) : t('result.duration', { seconds })}
        </li>
        <li className={FACT}>
          {t(`hints.${summary.orientation as 'landscape'}`, { defaultValue: summary.orientation })}
        </li>
      </ul>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{t('result.effects')}</p>
        <p className="text-sm text-foreground/90">
          {summary.effects.length > 0 ? summary.effects.join(' · ') : t('result.noEffects')}
        </p>
      </div>
      {warnings.length > 0 && (
        <ul className="grid gap-1">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
