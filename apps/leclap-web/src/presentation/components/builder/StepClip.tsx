import { FileUpload } from '@/presentation/components/FileUpload';
import { VideoEditor } from '@/features/editor/VideoEditor';
import { Card } from '@/presentation/components/ui';
import { recordingConfigForSection } from '@/lib/recordingConfig';
import type { VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { TemplateDescriptor } from '@/services/templateService';

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
}

// One focused screen for a single clip: record-with-camera or upload (max 1 file), wired to THIS
// section's recording config (countdown/duration/framing/what-to-film). Once captured, an inline
// trim/crop editor appears. Shared by both wizard modes (linear step + hub panel).
export const StepClip = ({
  section,
  clipNumber,
  totalClips,
  file,
  onFileChange,
  edit,
  onEditChange,
}: StepClipProps) => {
  const rec = recordingConfigForSection(section);
  const title = section.title?.en ?? `Clip ${clipNumber}`;
  const hint = rec.description ?? section.description?.en;

  return (
    <div className="fade-in mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
          {totalClips > 1 ? `Clip ${clipNumber} of ${totalClips}` : 'Your clip'}
        </p>
        <h2 className="mb-2 font-display text-4xl font-bold text-foreground">{title}</h2>
        {hint && <p className="text-lg text-gray-400">{hint}</p>}
      </div>
      <Card elevation="flat" className="glass-panel-dark space-y-6 p-6 shadow-2xl md:p-8">
        <FileUpload
          onFilesUploaded={(files) => {
            onFileChange(files[0]);
          }}
          uploadedFiles={file ? [file] : []}
          maxFiles={1}
          countdownSeconds={rec.countdownSeconds}
          maxDurationSeconds={rec.maxDurationSeconds}
          framingGuide={rec.framingGuide}
          description={rec.description}
        />
        {file && <VideoEditor file={file} label="Trim &amp; crop" edit={edit} onChange={onEditChange} />}
      </Card>
    </div>
  );
};
