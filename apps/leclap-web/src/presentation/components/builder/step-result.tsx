import { useTranslation } from 'react-i18next';
import { ExportPanel } from '@/presentation/components/ExportPanel';
import { ClappyCheer } from '@/presentation/components/clappy';
import { ArrowLeftIcon } from '@/presentation/components/icons/arrow-left';
import { ArrowRightIcon } from '@/presentation/components/icons/arrow-right';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { Button, Card, Reveal } from '@/presentation/components/ui';
import type { ProcessedVideo } from '@/hooks/useVideoProcessing';

interface StepResultProps {
  processedVideo: ProcessedVideo;
  onBack: () => void;
  onReset: () => void;
}

// The builder's last screen: the finished video, its export panel, and the two ways on — back to the edit,
// or a new project.
export const StepResult = ({ processedVideo, onBack, onReset }: StepResultProps) => {
  const { t } = useTranslation('builder');
  const { ref: backRef, hoverProps: backHoverProps } = useIconHover();
  const { ref: resetRef, hoverProps: resetHoverProps } = useIconHover();

  return (
    <div className="fade-in text-center max-w-4xl mx-auto">
      <div className="mb-12">
        {/* A finished render gets its clap: Clappy slams the clapper, with the clack when the sound is on. */}
        <ClappyCheer size={96} className="mb-4" />
        <h2 className="text-5xl font-bold font-display brand-gradient-text leading-[1.15] pb-1 mb-4">
          {t('stepResult.title')}
        </h2>
        <p className="text-gray-300 text-lg">{t('stepResult.subtitle')}</p>
      </div>
      <Reveal>
        <Card elevation="flat" className="glass-panel-dark p-8 md:p-12 shadow-2xl">
          <ExportPanel processedVideo={processedVideo} />
          <div className="mt-8 flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-foreground/5 hover:bg-foreground/10"
              {...backHoverProps}
            >
              <ArrowLeftIcon ref={backRef} size={18} />
              <span>{t('stepResult.editProject')}</span>
            </Button>
            <Button variant="link" onClick={onReset} className="w-full sm:w-auto px-6 py-3" {...resetHoverProps}>
              <span>{t('stepResult.createAnother')}</span>
              <ArrowRightIcon ref={resetRef} size={18} />
            </Button>
          </div>
        </Card>
      </Reveal>
    </div>
  );
};
