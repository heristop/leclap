// What the run is doing, inline where the result will appear: a step track (Thinking → Validating →
// Repairing → Ready) with an indeterminate bar while the model works, the error with its recovery,
// or the ready summary. One polite live region announces each step; errors use role="alert".
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2 } from '@/presentation/components/icons';
import { cn } from '@/lib/utils';
import { isRunning, statusLine, type FailureCopy, type RunStatus } from './ai-generation.logic';

type Step = 'thinking' | 'validating' | 'repairing' | 'ready';
const STEPS: Step[] = ['thinking', 'validating', 'repairing', 'ready'];

function currentStep(status: RunStatus): Step | null {
  if (status.kind === 'thinking' || status.kind === 'validating' || status.kind === 'repairing') return status.kind;

  return status.kind === 'ready' ? 'ready' : null;
}

// "Repairing" only appears when a repair round actually ran.
function visibleSteps(status: RunStatus): Step[] {
  const repaired = status.kind === 'repairing' || (status.kind === 'ready' && status.result.rounds > 1);

  return repaired ? STEPS : STEPS.filter((name) => name !== 'repairing');
}

const StepTrack = ({ status }: { status: RunStatus }) => {
  const { t } = useTranslation('ai');
  const steps = visibleSteps(status);
  const step = currentStep(status);
  const reached = step ? steps.indexOf(step) : -1;

  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {steps.map((name, index) => (
        <li
          key={name}
          aria-current={name === step ? 'step' : undefined}
          className={cn(
            'flex items-center gap-1.5 font-medium transition-colors duration-200',
            index <= reached ? 'text-foreground' : 'text-muted-foreground/70'
          )}
        >
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full bg-divider',
              index < reached && 'bg-brand-500/60',
              name === step && 'bg-brand-400'
            )}
          />
          {t(`steps.${name}`)}
        </li>
      ))}
    </ol>
  );
};

const ErrorPanel = ({ error, providerLabel }: { error: FailureCopy; providerLabel: string }) => {
  const { t } = useTranslation('ai');

  return (
    <div
      role="alert"
      className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 p-3 text-sm"
    >
      <p className="flex items-start gap-2 font-medium text-foreground">
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--color-error)]" />
        <span className="text-pretty">
          {t(`errors.${error.key}`, { provider: providerLabel, rounds: error.rounds ?? 0 })}
        </span>
      </p>
      {error.detail && (
        <details className="mt-2 pl-6 text-xs text-muted-foreground">
          <summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
            {t('actions.details')}
          </summary>
          <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono">{error.detail}</pre>
        </details>
      )}
    </div>
  );
};

interface GenerationStatusProps {
  status: RunStatus;
  providerLabel: string;
}

export const GenerationStatus = ({ status, providerLabel }: GenerationStatusProps) => {
  const { t } = useTranslation('ai');
  const line = statusLine(status);
  const running = isRunning(status);

  return (
    <div className="grid gap-2" aria-busy={running || undefined}>
      {(running || status.kind === 'ready') && <StepTrack status={status} />}
      {running && (
        <div className="h-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
          <div className="ai-progress-bar h-full w-1/3 rounded-full bg-brand-500" />
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {line ? t(line.key as 'status.thinking', line.values) : null}
        {status.kind === 'ready' && (
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <CheckCircle2 aria-hidden className="size-4 text-[var(--color-success)]" />
            {t('status.ready')}
          </span>
        )}
      </p>
      {status.kind === 'error' && <ErrorPanel error={status.error} providerLabel={providerLabel} />}
    </div>
  );
};
