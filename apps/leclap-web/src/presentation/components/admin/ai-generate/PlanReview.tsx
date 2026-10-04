// The plan step: what the video tells whom, three concepts (the model's pick preselected, each with
// how expected it is), and a compact beat sheet whose copy, verb and length can be edited before the
// template is written. Plain labelled controls in a real table, so it reads well to screen readers.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { PLAN_MAX_BEAT_SECONDS, planSeconds, type TemplatePlan } from '@/application/usecases/ai-template/plan';
import { cn } from '@/lib/utils';
import { Input } from '@/presentation/components/ui';
import { NumberField } from '@/presentation/components/ui/NumberField';
import { chooseConcept, editBeat, editStrategy, typicalityKey, type BeatPatch } from './plan-review.logic';

interface PlanReviewProps {
  plan: TemplatePlan;
  onChange: (plan: TemplatePlan) => void;
}

const LABEL = 'mb-1.5 block text-sm font-medium text-foreground';
const CELL_INPUT = 'h-8 rounded-md px-2 py-1 text-sm';
const FACT = 'rounded-md bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium tabular-nums text-foreground/90';

const Concepts = ({ plan, onChange }: PlanReviewProps) => {
  const { t } = useTranslation('ai');
  const name = useId();

  return (
    <fieldset>
      <legend className={LABEL}>{t('plan.concepts')}</legend>
      <div className="grid gap-1.5">
        {plan.concepts.map((concept, index) => (
          <label
            key={`${String(index)}-${concept.concept}`}
            className={cn(
              'tap flex cursor-pointer items-start gap-2.5 rounded-lg border border-divider bg-surface-2 px-3 py-2 text-sm transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/40',
              index === plan.chosen && 'border-brand-500/60 bg-brand-500/[0.06]'
            )}
          >
            <input
              type="radio"
              name={name}
              checked={index === plan.chosen}
              onChange={() => {
                onChange(chooseConcept(plan, index));
              }}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand-500)]"
            />
            <span className="grow text-pretty text-foreground">{concept.concept}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t(`plan.typicality.${typicalityKey(concept.typicality)}`)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

const BeatTable = ({ plan, onChange }: PlanReviewProps) => {
  const { t } = useTranslation('ai');
  const patch = (index: number, change: BeatPatch): void => {
    onChange(editBeat(plan, index, change));
  };

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[32rem] border-separate border-spacing-y-1 text-left text-sm">
        <caption className="mb-1.5 text-left text-sm font-medium text-foreground">{t('plan.beats')}</caption>
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="w-8 font-medium">
              #
            </th>
            <th scope="col" className="w-24 font-medium">
              {t('plan.role')}
            </th>
            <th scope="col" className="w-28 font-medium">
              {t('plan.verb')}
            </th>
            <th scope="col" className="font-medium">
              {t('plan.onScreen')}
            </th>
            <th scope="col" className="w-28 font-medium">
              {t('plan.seconds')}
            </th>
          </tr>
        </thead>
        <tbody>
          {plan.beats.map((beat, index) => {
            const row = String(index + 1);

            return (
              <tr key={`${row}-${beat.section}`} className="align-top">
                <td className="pt-1.5 tabular-nums text-muted-foreground">{row}</td>
                <th scope="row" className="pt-1.5 pr-2 font-normal text-foreground/90" title={beat.why || undefined}>
                  {beat.role}
                </th>
                <td className="pr-2">
                  <Input
                    aria-label={t('plan.verbLabel', { row })}
                    value={beat.verb}
                    onChange={(event) => {
                      patch(index, { verb: event.target.value.toUpperCase() });
                    }}
                    className={cn(CELL_INPUT, 'font-mono text-xs uppercase')}
                  />
                </td>
                <td className="pr-2">
                  <Input
                    aria-label={t('plan.onScreenLabel', { row })}
                    value={beat.onScreen}
                    placeholder={t('plan.footage')}
                    onChange={(event) => {
                      patch(index, { onScreen: event.target.value });
                    }}
                    className={CELL_INPUT}
                  />
                  {beat.why && <p className="mt-0.5 px-2 text-xs text-pretty text-muted-foreground">{beat.why}</p>}
                </td>
                <td>
                  <NumberField
                    compact
                    value={beat.seconds}
                    min={0.1}
                    max={PLAN_MAX_BEAT_SECONDS}
                    step={0.5}
                    unit="s"
                    aria-label={t('plan.secondsLabel', { row })}
                    onChange={(value) => {
                      patch(index, { seconds: value });
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const PlanReview = ({ plan, onChange }: PlanReviewProps) => {
  const { t } = useTranslation('ai');
  const id = useId();
  const seconds = Number(planSeconds(plan).toFixed(1));
  const accents = plan.transitions.accents.join(', ');

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid gap-4 rounded-xl border border-divider bg-surface-2/60 p-4"
    >
      <div>
        <h3 id={`${id}-title`} className="text-base font-semibold text-foreground">
          {t('plan.title')}
        </h3>
        <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{t('plan.intro')}</p>
      </div>
      <div>
        <label htmlFor={`${id}-strategy`} className={LABEL}>
          {t('plan.strategy')}
        </label>
        <Input
          id={`${id}-strategy`}
          value={plan.strategy}
          onChange={(event) => {
            onChange(editStrategy(plan, event.target.value));
          }}
          className="text-sm"
        />
      </div>
      <Concepts plan={plan} onChange={onChange} />
      <BeatTable plan={plan} onChange={onChange} />
      <ul className="flex flex-wrap gap-1.5" aria-label={t('plan.facts')}>
        <li className={FACT}>{t('result.duration', { seconds })}</li>
        <li className={FACT}>
          {accents
            ? t('plan.transitionsWithAccents', { primary: plan.transitions.primary, accents })
            : t('plan.transitions', { primary: plan.transitions.primary })}
        </li>
        {plan.theme && <li className={FACT}>{t('jev.theme', { name: plan.theme })}</li>}
        {plan.platform && <li className={FACT}>{plan.platform}</li>}
      </ul>
    </section>
  );
};
