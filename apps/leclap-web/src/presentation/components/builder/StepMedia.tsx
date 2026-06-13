import { useTranslation } from 'react-i18next';
import { Card } from '@/presentation/components/ui';
import { MediaPicker } from '@/presentation/components/admin/MediaPicker';
import type { MediaChoice } from '@/presentation/components/admin/templateEditorModel';
import type { Template } from '@/services/templateService';

interface StepMediaProps {
  selectedTemplate: Template;
  musicChoice: MediaChoice | null;
  backgroundChoice: MediaChoice | null;
  onMusicChange: (c: MediaChoice | null) => void;
  onBackgroundChange: (c: MediaChoice | null) => void;
}

// Music + background pickers for the linear wizard's media step. Shown only when the template
// allows a music or background choice.
export const StepMedia = ({
  selectedTemplate,
  musicChoice,
  backgroundChoice,
  onMusicChange,
  onBackgroundChange,
}: StepMediaProps) => {
  const { t } = useTranslation('builder');
  const g = selectedTemplate.descriptor.global ?? {};
  const showMusic = (g.allowedMusic?.length ?? 0) > 0 || Boolean(g.allowUploadMusic);
  const showBackground = (g.allowedBackgrounds?.length ?? 0) > 0 || Boolean(g.allowUploadBackground);

  return (
    <div className="fade-in max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold font-display text-foreground mb-2">{t('stepMedia.title')}</h2>
        <p className="text-gray-400 text-lg">{t('stepMedia.subtitle')}</p>
      </div>
      <div className="space-y-8">
        {showMusic && (
          <Card elevation="flat" className="glass-panel-dark p-6 md:p-8 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 font-display text-foreground">{t('stepMedia.music')}</h3>
            <MediaPicker
              kind="music"
              value={musicChoice}
              onChange={onMusicChange}
              allowedIds={g.allowedMusic}
              allowUpload={Boolean(g.allowUploadMusic)}
            />
          </Card>
        )}
        {showBackground && (
          <Card elevation="flat" className="glass-panel-dark p-6 md:p-8 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 font-display text-foreground">{t('stepMedia.background')}</h3>
            <MediaPicker
              kind="picture"
              value={backgroundChoice}
              onChange={onBackgroundChange}
              allowedIds={g.allowedBackgrounds}
              allowUpload={Boolean(g.allowUploadBackground)}
            />
          </Card>
        )}
      </div>
    </div>
  );
};
