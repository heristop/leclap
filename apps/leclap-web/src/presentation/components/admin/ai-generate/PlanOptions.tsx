// Two switches for the plan step: plan first (on by default: a small extra call that pitches three
// concepts and a beat sheet before any JSON is written), and whether to stop and review that plan
// or carry straight on. Review only means something when planning is on.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/presentation/components/ui';

interface PlanOptionsProps {
  planFirst: boolean;
  onPlanFirstChange: (value: boolean) => void;
  reviewPlan: boolean;
  onReviewPlanChange: (value: boolean) => void;
  disabled: boolean;
}

interface OptionProps {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
  label: string;
  hint: string;
}

const Option = ({ id, checked, onChange, disabled, label, hint }: OptionProps) => (
  <div className="flex items-start gap-3">
    <Checkbox
      id={id}
      checked={checked}
      disabled={disabled}
      aria-describedby={`${id}-hint`}
      onCheckedChange={(value) => {
        onChange(value === true);
      }}
    />
    <div className="grid gap-0.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-xs text-pretty text-muted-foreground">
        {hint}
      </p>
    </div>
  </div>
);

export const PlanOptions = (props: PlanOptionsProps) => {
  const { t } = useTranslation('ai');
  const id = useId();

  return (
    <div className="grid gap-3">
      <Option
        id={`${id}-plan`}
        checked={props.planFirst}
        onChange={props.onPlanFirstChange}
        disabled={props.disabled}
        label={t('plan.planFirst')}
        hint={t('plan.planFirstHint')}
      />
      <Option
        id={`${id}-review`}
        checked={props.planFirst && props.reviewPlan}
        onChange={props.onReviewPlanChange}
        disabled={props.disabled || !props.planFirst}
        label={t('plan.review')}
        hint={t('plan.reviewHint')}
      />
    </div>
  );
};
