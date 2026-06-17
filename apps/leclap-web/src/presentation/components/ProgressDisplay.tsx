import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Cpu, CheckCircle2, AlertCircle, Zap, ShieldCheck, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Card } from '@/presentation/components/ui';

interface ProcessingProgress {
  stage: string;
  percentage: number;
  currentStep: string;
  totalSteps: number;
  currentStepIndex: number;
  estimatedTimeRemaining?: number;
}

interface ProgressDisplayProps {
  progress: ProcessingProgress;
}

const formatTime = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
};

const getStageIcon = (percentage: number) => {
  if (percentage >= 100) return CheckCircle2;

  if (percentage === 0) return AlertCircle;

  return Cpu;
};

const getProgressColor = (percentage: number): string => {
  // One on-brand fill (lavender→pink) that turns success-green on completion —
  // not a rainbow ramp. A single travelling shimmer (below) carries the motion;
  // the fill itself stays still so the two don't compete.
  if (percentage >= 100) return 'bg-success';

  return 'brand-gradient';
};

interface StepIndicatorProps {
  stepNumber: number;
  currentStepIndex: number;
}

// Angles (deg) for the one-shot success burst — an even ring of 6 dots.
const BURST_ANGLES = [0, 60, 120, 180, 240, 300];

// A radial pop of dots, mounted only for the moment a step completes. The
// caller re-mounts it via `key` so the animation restarts on each success.
const SuccessBurst = () => (
  <span aria-hidden className="pointer-events-none absolute inset-0">
    {BURST_ANGLES.map((angle, i) => (
      <span key={angle} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${angle}deg)` }}>
        <span
          className="dot-burst block h-1 w-1 -ml-0.5 -mt-0.5 rounded-full bg-success"
          style={{ animationDelay: `${i * 16}ms` }}
        />
      </span>
    ))}
  </span>
);

const StepIndicator = ({ stepNumber, currentStepIndex }: StepIndicatorProps) => {
  const isCompleted = stepNumber < currentStepIndex;
  const isCurrent = stepNumber === currentStepIndex;
  const isPending = stepNumber > currentStepIndex;

  // Fire the burst once, on the false→true completion edge — not on mount when a
  // step is already done, nor on unrelated re-renders. Each edge bumps the key so
  // the burst element re-mounts and replays.
  const [burstKey, setBurstKey] = useState(0);
  const wasCompleted = useRef(isCompleted);

  useEffect(() => {
    if (isCompleted && !wasCompleted.current) {
      setBurstKey((key) => key + 1);
    }

    wasCompleted.current = isCompleted;
  }, [isCompleted]);

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative">
        <div
          className={clsx(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.34,1.2,0.64,1)] border',
            isCompleted &&
              'bg-success border-success text-success-foreground scale-105 shadow-[0_0_10px_oklch(0.84_0.065_160/0.45)]',
            isCurrent &&
              'brand-gradient border-transparent text-white animate-pulse motion-reduce:animate-none ring-4 ring-brand-500/25',
            isPending && 'bg-surface-2 border-foreground/15 text-gray-500'
          )}
        >
          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : stepNumber}
        </div>
        {burstKey > 0 && <SuccessBurst key={burstKey} />}
      </div>
      <div
        className={clsx(
          'w-2 h-1 rounded-full transition-all duration-300',
          isCompleted && 'bg-success',
          isCurrent && 'bg-brand-500',
          isPending && 'bg-foreground/15'
        )}
      />
    </div>
  );
};

interface MetricProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

const Metric = ({ icon: Icon, label, value }: MetricProps) => (
  <div className="text-center">
    <div className="flex items-center justify-center space-x-1 text-sm text-gray-400 mb-1">
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
    <p className="text-lg font-semibold text-foreground">{value}</p>
  </div>
);

interface PerformanceMetricsProps {
  percentage: number;
  elapsedMs: number;
}

// Three distinct readouts: where it runs, how long it's taken, and the headline %. A "stage X/Y"
// cell is intentionally absent — it would only restate the header step and the bar.
const PerformanceMetrics = ({ percentage, elapsedMs }: PerformanceMetricsProps) => {
  const { t } = useTranslation('process');

  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-surface/40 rounded-xl border border-foreground/5">
      <Metric icon={ShieldCheck} label={t('progress.metrics.private')} value={t('progress.metrics.onDevice')} />
      <Metric icon={Clock} label={t('progress.metrics.elapsed')} value={formatTime(elapsedMs)} />
      <Metric icon={Zap} label={t('progress.metrics.progress')} value={`${Math.round(percentage)}%`} />
    </div>
  );
};

interface ProgressHeaderProps {
  stage: string;
  percentage: number;
  currentStepIndex: number;
  totalSteps: number;
  estimatedTimeRemaining?: number;
}

const ProgressHeader = ({
  stage,
  percentage,
  currentStepIndex,
  totalSteps,
  estimatedTimeRemaining,
}: ProgressHeaderProps) => {
  const { t } = useTranslation('process');
  const StageIcon = getStageIcon(percentage);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div
          className={clsx(
            'p-2 rounded-lg transition-all duration-300',
            percentage >= 100
              ? 'bg-success/15 text-success-foreground'
              : 'bg-brand-500/15 text-brand-700 dark:text-brand-300'
          )}
        >
          <StageIcon
            className={clsx(
              'w-5 h-5',
              percentage < 100 && percentage > 0 && 'animate-pulse motion-reduce:animate-none'
            )}
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {stage.length > 0 ? stage : t('progress.header.title')}
          </h3>
          <p className="text-sm text-gray-400">
            {t('progress.header.step', { current: currentStepIndex, total: totalSteps })}
          </p>
        </div>
      </div>

      {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{t('progress.header.timeRemaining', { time: formatTime(estimatedTimeRemaining) })}</span>
        </div>
      )}
    </div>
  );
};

interface ProgressBarProps {
  percentage: number;
  currentStep: string;
}

const ProgressBar = ({ percentage, currentStep }: ProgressBarProps) => {
  const { t } = useTranslation('process');
  const progressColor = getProgressColor(percentage);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-300">
          {currentStep.length > 0 ? currentStep : t('progress.bar.currentStepFallback')}
        </span>
        <span
          className={clsx(
            'font-semibold',
            percentage >= 100 ? 'text-success-foreground' : 'text-brand-700 dark:text-brand-300'
          )}
        >
          {Math.round(percentage)}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('progress.bar.ariaLabel')}
        className="relative w-full h-3 bg-foreground/10 rounded-full overflow-hidden border border-foreground/5"
      >
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden motion-reduce:transition-none',
            progressColor
          )}
          style={{ width: `${Math.max(percentage, 0)}%` }}
        >
          {percentage < 100 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-[shimmer_1.5s_infinite] motion-reduce:hidden" />
          )}
        </div>
      </div>
    </div>
  );
};

export const ProgressDisplay = ({ progress }: ProgressDisplayProps) => {
  const { t } = useTranslation('process');
  const { stage, percentage: rawPercentage, currentStep, totalSteps, estimatedTimeRemaining } = progress;

  // The bar is the single source of truth. Keep it monotonic so a late segment resetting its raw
  // fraction can't rewind it; a fresh run (raw back near 0) drops the floor so the next compile starts over.
  const maxPctRef = useRef(0);

  if (rawPercentage <= 1) {
    maxPctRef.current = rawPercentage;
  }

  const percentage = Math.max(maxPctRef.current, rawPercentage);
  maxPctRef.current = percentage;

  // Derive the active dot from the bar so the dots march 1→N in lockstep with progress instead of
  // sitting on a hardcoded step; one past the last when complete so every dot reads done.
  const done = percentage >= 100;
  const activeStep = done
    ? totalSteps + 1
    : Math.min(totalSteps, Math.max(1, Math.ceil((percentage / 100) * totalSteps)));
  const headerStep = Math.min(activeStep, totalSteps);

  // Live elapsed time: the clock starts when this mounts (the compile is what mounts it) and freezes
  // at completion.
  const startRef = useRef<number | null>(null);

  startRef.current ??= Date.now();

  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const tick = () => {
      setElapsedMs(Date.now() - (startRef.current ?? Date.now()));
    };

    tick();

    if (done) {
      return () => {};
    }

    const id = window.setInterval(tick, 500);

    return () => {
      window.clearInterval(id);
    };
  }, [done]);

  return (
    <div className="space-y-6 processing fade-in" role="status" aria-live="polite" aria-atomic="false">
      <ProgressHeader
        stage={stage}
        percentage={percentage}
        currentStepIndex={headerStep}
        totalSteps={totalSteps}
        estimatedTimeRemaining={estimatedTimeRemaining}
      />

      <ProgressBar percentage={percentage} currentStep={currentStep} />

      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 sm:justify-between sm:gap-x-1">
        {Array.from({ length: totalSteps }, (_, index) => (
          <StepIndicator key={index + 1} stepNumber={index + 1} currentStepIndex={activeStep} />
        ))}
      </div>

      <PerformanceMetrics percentage={percentage} elapsedMs={elapsedMs} />

      {percentage >= 100 && (
        <Card elevation="flat" className="bg-success/[0.12] border-success/30 p-4 fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-success rounded-lg shadow-lg shadow-success/20">
              <CheckCircle2 className="w-5 h-5 text-success-foreground" />
            </div>
            <div>
              <h4 className="font-semibold text-success-foreground">{t('progress.complete.title')}</h4>
              <p className="text-sm text-success-foreground/80">{t('progress.complete.description')}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
