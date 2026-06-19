import { useTranslation } from 'react-i18next';
import { FileUpload } from '@/presentation/components/FileUpload';
import { VideoEditor } from '@/features/editor/VideoEditor';
import { Card } from '@/presentation/components/ui';
import { recordingConfigForSection } from '@/lib/recordingConfig';
import { resolveTranslation, resolveVariables } from '@/lib/i18nText';
import type { VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { TemplateDescriptor } from '@/services/templateService';
import type { TemplateOrientation } from '@leclap/creative-kit';

type Section = NonNullable<TemplateDescriptor['sections']>[number];

interface StepClipProps {
  // The `project_video` section this clip fills.
  section: Section;
  // 1-based position among the template's clips, and the total, for the "Clip N of M" eyebrow.
  clipNumber: number;
  totalClips: number;
  file: File | undefined;
  onFileChange: (file: File | undefined) => void;
  edit: VideoEdit | undefined;
  onEditChange: (edit: VideoEdit | undefined) => void;
  // Variable map (global variables + colorN + form answers) used to resolve {{ tokens }} in the
  // section's title/description before they are shown.
  vars: Record<string, string | string[]>;
  // When false, render only the capture body — no centered header, no outer Card. The hub side sheet
  // supplies its own header/container, so the page chrome would just be a redundant card-in-card.
  chrome?: boolean;
  // Template orientation — drives the camera frame + recording aspect (9:16 portrait, 1:1 square).
  orientation?: TemplateOrientation;
}

// One focused screen for a single clip: record-with-camera or upload (max 1 file), wired to THIS
// section's recording config (countdown/duration/framing/what-to-film). Once captured, an inline
// trim/crop editor appears. Shared by both wizard modes (linear step = full chrome; hub sheet = bare).
export const StepClip = ({
  section,
  clipNumber,
  totalClips,
  file,
  onFileChange,
  edit,
  onEditChange,
  vars,
  chrome = true,
  orientation,
}: StepClipProps) => {
  const { t, i18n } = useTranslation('builder');
  const rec = recordingConfigForSection(section);
  const resolvedTitle = resolveTranslation(section.title, i18n.language);
  const title = resolvedTitle ? resolveVariables(resolvedTitle, vars) : t('steps.clip', { number: clipNumber });
  // The recording config already resolved the description to the current locale; substitute its
  // {{ tokens }} so the recorder reads the real prompt ("Cats or Dogs?") rather than raw tokens.
  const hint = rec.description ? resolveVariables(rec.description, vars) : undefined;

  const capture = (
    <>
      <FileUpload
        onFilesUploaded={(files) => {
          onFileChange(files[0]);
        }}
        uploadedFiles={file ? [file] : []}
        maxFiles={1}
        countdownSeconds={rec.countdownSeconds}
        maxDurationSeconds={rec.maxDurationSeconds}
        framingGuide={rec.framingGuide}
        description={hint}
        orientation={orientation}
        defaultCaptureMode={rec.defaultCaptureMode}
        allowedCaptureModes={rec.allowedCaptureModes}
      />
      {file && <VideoEditor file={file} label={t('stepClip.editorLabel')} edit={edit} onChange={onEditChange} />}
    </>
  );

  if (!chrome) return <div className="space-y-6">{capture}</div>;

  return (
    <div className="fade-in mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
          {totalClips > 1 ? t('stepClip.clipOf', { number: clipNumber, total: totalClips }) : t('steps.yourClip')}
        </p>
        <h2 className="mb-2 font-display text-4xl font-bold text-foreground">{title}</h2>
        {hint && <p className="text-lg text-gray-400">{hint}</p>}
      </div>
      <Card elevation="flat" className="glass-panel-dark space-y-6 p-6 shadow-2xl md:p-8">
        {capture}
      </Card>
    </div>
  );
};
