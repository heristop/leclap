import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { type Template } from '@/services/templateService';
import type { useVideoProcessing } from '@/hooks/useVideoProcessing';
import type { QualityTier } from 'ffmpeg-video-composer/src/core/encoding.ts';
import type { CompileFailure } from '@/application/usecases/compile-failure';
import { CompileFailureText } from '@/presentation/components/compile-failure-text';
import { ProgressDisplay } from '@/presentation/components/ProgressDisplay';
import { StopButton } from '@/presentation/components/StopButton';
import { ClappyReaction } from '@/presentation/components/clappy';
import { ArrowLeft, RotateCcw } from '@/presentation/components/icons';
import { Button } from '@/presentation/components/ui';
import { CompileSummary } from './CompileSummary';
import { compilePhase } from './compileState';

interface CompileMonitorProps {
  template: Template;
  clipFiles: File[];
  formData: Record<string, string>;
  isProcessing: boolean;
  progress: ReturnType<typeof useVideoProcessing>['progress'];
  error: CompileFailure | null;
  qualityTier: QualityTier;
  onCancel: () => void;
  onRetry: () => void;
  onBackToEdit: () => void;
}

interface RenderFailedProps {
  error: CompileFailure;
  onRetry: () => void;
  onBackToEdit: () => void;
  t: TFunction<'builder'>;
}

// A failed render takes the monitor over: the progress bar has nothing true left to say, and a Clappy
// still running it would be lying. He calls "cut" instead, above what went wrong and the two ways on.
// The cause is in the viewer's language; an engine message the app has no words for follows it verbatim.
const RenderFailed = ({ error, onRetry, onBackToEdit, t }: RenderFailedProps) => (
  <div role="alert" className="fade-in flex flex-col items-center py-4 text-center sm:py-8">
    <ClappyReaction reaction="cut" size={104} />
    <h3 className="mt-4 font-display text-2xl font-bold text-foreground">{t('compile.errorTitle')}</h3>
    <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{t('compile.errorHint')}</p>
    <p className="mt-4 max-w-md rounded-lg bg-[var(--color-error)]/10 px-3 py-2 text-sm text-foreground/85 ring-1 ring-[var(--color-error)]/25">
      <CompileFailureText failure={error} />
    </p>
    <div className="mt-6 flex w-full flex-col-reverse items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Button variant="ghost" onClick={onBackToEdit}>
        <ArrowLeft className="size-4!" />
        {t('compile.backToEdit')}
      </Button>
      <Button onClick={onRetry}>
        <RotateCcw className="size-4!" />
        {t('actions.tryAgain', { ns: 'common' })}
      </Button>
    </div>
  </div>
);

// The render monitor: a wide program-monitor column (the ProgressDisplay hero on a studio-stage
// backdrop, with Stop under it) beside a narrow project summary rail. Stacks on mobile. The studio
// titlebar names the project, and the progress headline names the stage, so the stage carries no
// label of its own.
export const CompileMonitor = ({
  template,
  clipFiles,
  formData,
  isProcessing,
  progress,
  error,
  qualityTier,
  onCancel,
  onRetry,
  onBackToEdit,
}: CompileMonitorProps) => {
  const { t } = useTranslation('builder');
  const phase = compilePhase({ isProcessing, percentage: progress.percentage, failed: error !== null });

  return (
    <div className="fade-in grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <section className="studio-stage overflow-hidden rounded-2xl border border-foreground/10 p-5 sm:p-8">
        {phase === 'error' && error ? (
          <RenderFailed error={error} onRetry={onRetry} onBackToEdit={onBackToEdit} t={t} />
        ) : (
          <>
            <ProgressDisplay progress={progress} />
            <div className="mt-6 flex justify-center">
              {phase === 'complete' ? (
                <p className="text-sm text-muted-foreground">{t('compile.finishing')}</p>
              ) : (
                <StopButton onClick={onCancel} label={t('compile.stop')} />
              )}
            </div>
          </>
        )}
      </section>

      <CompileSummary template={template} clipCount={clipFiles.length} formData={formData} qualityTier={qualityTier} />
    </div>
  );
};
