// "Preview render": compile the CURRENT descriptor through the real WASM pipeline with PLACEHOLDER
// media (generated brand-gradient clips for project_video sections; form fields filled with their
// own labels) at native resolution with the ultrafast preset, so an author sees a draft of their
// template without real footage. Progress is shown with the existing ProgressDisplay; the output
// plays in a dialog. The button is disabled while a render runs and guards against double-clicks.
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Clapperboard, Download, AlertCircle } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/presentation/components/ui';
import { coreCompilationService, type CompilationProgress } from '@/application/usecases/coreCompilationService';
import { logger } from '@/lib/logger';
import { ProgressDisplay } from '@/presentation/components/ProgressDisplay';
import { VideoPreview } from '@/presentation/components/VideoPreview';
import type { EditorState } from '../templateEditorModel';
import { buildPreviewPlan } from './previewRender';
import { generatePlaceholderClips } from './placeholderClips';

interface TestRenderButtonProps {
  state: EditorState;
  // Hard validation errors block the render — same gate as Save.
  disabled?: boolean;
}

interface RenderResult {
  url: string;
}

const idleProgress: CompilationProgress = {
  stage: '',
  percentage: 0,
  currentStep: '',
  totalSteps: 7,
  currentStepIndex: 0,
};

export const TestRenderButton = ({ state, disabled = false }: TestRenderButtonProps) => {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<CompilationProgress>(idleProgress);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guards against concurrent renders even if the button somehow fires twice.
  const inFlight = useRef(false);
  const lastUrl = useRef<string | null>(null);

  const cleanupUrl = (): void => {
    if (lastUrl.current) {
      URL.revokeObjectURL(lastUrl.current);
      lastUrl.current = null;
    }
  };

  const runRender = async (): Promise<void> => {
    if (inFlight.current) return;

    inFlight.current = true;
    setRendering(true);
    setOpen(true);
    setError(null);
    setResult(null);
    cleanupUrl();
    setProgress(idleProgress);

    try {
      const plan = buildPreviewPlan(state);
      const files = await generatePlaceholderClips(state, plan.clipCount);
      const compiled = await coreCompilationService.compileVideo(
        {
          template: plan.template,
          formData: plan.formData,
          files,
          videoConfig: plan.videoConfig,
          // The draft renders at native resolution (so absolute-pixel overlays line up), so push the
          // encoder to its fastest preset to keep it quick.
          preset: 'ultrafast',
        },
        setProgress
      );
      lastUrl.current = compiled.url;
      setResult({ url: compiled.url });
    } catch (error) {
      logger.error('Preview render failed:', error);
      setError(error instanceof Error ? error.message : t('testRender.failed'));
    } finally {
      inFlight.current = false;
      setRendering(false);
    }
  };

  const onOpenChange = (next: boolean): void => {
    // Keep the dialog open while a render is in flight so progress isn't lost.
    if (rendering) return;

    setOpen(next);

    if (!next) {
      cleanupUrl();
      setResult(null);
      setError(null);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          runRender().catch(() => {});
        }}
        disabled={disabled || rendering}
        className="min-h-11"
        aria-label={t('testRender.ariaLabel')}
      >
        <Clapperboard className="h-5 w-5" /> {rendering ? t('testRender.rendering') : t('testRender.preview')}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('testRender.title')}</DialogTitle>
            <DialogDescription>{t('testRender.description')}</DialogDescription>
          </DialogHeader>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3.5 py-2.5 text-sm font-medium text-[var(--color-error)]"
            >
              <AlertCircle className="mt-px size-4 shrink-0" /> {error}
            </div>
          )}

          {rendering && <ProgressDisplay progress={progress} />}

          {result && !rendering && (
            <div className="space-y-3">
              <VideoPreview url={result.url} />
              <a
                href={result.url}
                download="preview.mp4"
                className="tap inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-gray-200"
              >
                <Download className="h-4 w-4" /> {t('testRender.download')}
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
