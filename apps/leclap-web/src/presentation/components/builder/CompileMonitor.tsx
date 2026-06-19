import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { type Template } from '@/services/templateService';
import type { useVideoProcessing } from '@/hooks/useVideoProcessing';
import { ProgressDisplay } from '@/presentation/components/ProgressDisplay';
import { StopButton } from '@/presentation/components/StopButton';
import { CompileSummary } from './CompileSummary';
import { compilePhase, type CompilePhase } from './compileState';

interface CompileMonitorProps {
  template: Template;
  clipFiles: File[];
  formData: Record<string, string>;
  isProcessing: boolean;
  progress: ReturnType<typeof useVideoProcessing>['progress'];
  error: string | null;
  onCancel: () => void;
}

const eyebrowKey: Record<CompilePhase, string> = {
  preparing: 'compile.preparing',
  rendering: 'compile.rendering',
  complete: 'compile.complete',
  error: 'compile.failed',
};

// The phase name as a small uppercase eyebrow — the studio titlebar already names the project, so this
// only states where the render is.
const MonitorEyebrow = ({ phase, t }: { phase: CompilePhase; t: TFunction<'builder'> }) => (
  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
    {t(eyebrowKey[phase])}
  </p>
);

// The single control under the monitor, chosen by phase: Stop while it runs, an error panel on failure,
// a quiet "Finishing…" hint at completion. Early returns, no else.
const MonitorControl = ({
  phase,
  error,
  onCancel,
  t,
}: {
  phase: CompilePhase;
  error: string | null;
  onCancel: () => void;
  t: TFunction<'builder'>;
}) => {
  if (phase === 'error') {
    return (
      <div className="rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 p-4 text-center">
        <p className="text-sm font-semibold text-[var(--color-error)]">{t('compile.errorTitle')}</p>
        {error && <p className="mt-1 text-sm text-[var(--color-error)]/80">{error}</p>}
      </div>
    );
  }

  if (phase === 'complete') {
    return <p className="text-center text-sm text-muted-foreground">{t('compile.finishing')}</p>;
  }

  return (
    <div className="flex justify-center">
      <StopButton size="lg" onClick={onCancel} label={t('compile.stop')} />
    </div>
  );
};

// The render monitor: a wide program-monitor column (the existing ProgressDisplay hero on a studio-stage
// backdrop, with the single phase-appropriate control) beside a narrow project summary rail. Stacks on
// mobile. The studio titlebar names the project — no marketing hero here.
export const CompileMonitor = ({
  template,
  clipFiles,
  formData,
  isProcessing,
  progress,
  error,
  onCancel,
}: CompileMonitorProps) => {
  const { t } = useTranslation('builder');
  const phase = compilePhase({ isProcessing, percentage: progress.percentage, error });

  return (
    <div className="fade-in grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <section className="studio-stage overflow-hidden rounded-2xl border border-foreground/10 p-6 sm:p-8">
        <MonitorEyebrow phase={phase} t={t} />

        <div className="mt-5">
          <ProgressDisplay progress={progress} />
        </div>

        <div className="mt-6">
          <MonitorControl phase={phase} error={error} onCancel={onCancel} t={t} />
        </div>
      </section>

      <CompileSummary template={template} clipCount={clipFiles.length} formData={formData} />
    </div>
  );
};
