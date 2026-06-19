import { Check } from '@/presentation/components/icons';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface StepperProps {
  steps: string[];
  currentStep: number;
  className?: string;
  onStepClick?: (stepIndex: number) => void;
}

function stepCircleClasses(isCompleted: boolean, isCurrent: boolean, isClickable: boolean): string {
  return cn(
    'relative z-10 grid h-10 w-10 place-items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
    isCompleted && 'brand-gradient text-white shadow-sm shadow-brand-500/20',
    isCurrent && 'step-pulse bg-background text-brand-600 dark:text-brand-300 ring-2 ring-brand-500 scale-105',
    !isCompleted && !isCurrent && 'bg-surface text-gray-500 ring-1 ring-foreground/15',
    isClickable && 'group-hover:scale-110'
  );
}

function stepLabelClasses(isCompleted: boolean, isCurrent: boolean): string {
  return cn(
    'hidden sm:block max-w-[7rem] truncate text-center text-[0.7rem] font-semibold uppercase tracking-wider transition-colors duration-300',
    isCurrent && 'text-brand-600 dark:text-brand-300',
    isCompleted && 'text-gray-400 group-hover:text-foreground',
    !isCompleted && !isCurrent && 'text-gray-500'
  );
}

export const Stepper = ({ steps, currentStep, className, onStepClick }: StepperProps) => {
  const { t } = useTranslation('shell');
  const progress = steps.length > 1 ? (currentStep / (steps.length - 1)) * 100 : 0;

  return (
    <nav aria-label={t('stepperProgress')} className={cn('w-full', className)}>
      <ol className="relative flex items-start justify-between">
        {/* Connector track + progress fill (centered on the 2.5rem circles) */}
        <div className="absolute left-0 right-0 top-5 -z-10 h-0.5 -translate-y-1/2 bg-foreground/10" />
        <div
          className="absolute left-0 top-5 -z-10 h-0.5 -translate-y-1/2 rounded-full brand-gradient transition-all duration-500 ease-[var(--ease-out-expo)]"
          style={{ width: `${progress}%` }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = Boolean(onStepClick) && (isCompleted || isCurrent);

          return (
            <li
              key={step}
              className={cn('group flex flex-col items-center gap-2.5', isClickable && 'cursor-pointer')}
              onClick={() => {
                if (isClickable && onStepClick) {
                  onStepClick(index);
                }
              }}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className={stepCircleClasses(isCompleted, isCurrent, isClickable)}>
                {isCompleted ? (
                  <Check className="h-5 w-5 pop-in" />
                ) : (
                  <span className="text-sm font-bold font-display">{index + 1}</span>
                )}
              </div>

              <span className={stepLabelClasses(isCompleted, isCurrent)}>{step}</span>
            </li>
          );
        })}
      </ol>

      {/* Compact indicator on small screens (labels are hidden there) */}
      <p className="sm:hidden mt-4 text-center text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
        {t('stepperStep', { current: currentStep + 1, total: steps.length })}
        <span className="text-gray-500"> · {steps[currentStep]}</span>
      </p>
    </nav>
  );
};
