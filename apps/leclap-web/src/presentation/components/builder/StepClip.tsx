import { useTranslation } from 'react-i18next';
import { FileUpload } from '@/presentation/components/FileUpload';
import { TimelineEditor } from '@/features/editor/TimelineEditor';
import { Card } from '@/presentation/components/ui';
import { recordingConfigForSection } from '@/lib/recordingConfig';
import { resolveTranslation, resolveVariables } from '@/lib/i18nText';
import type { VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { TemplateDescriptor } from '@/services/templateService';
import type { TemplateOrientation } from '@leclap/creative-kit';
import { RushChooser } from './RushChooser';

type Section = NonNullable<TemplateDescriptor['sections']>[number];

interface StepClipProps {
  // The `project_video` section this clip fills.
  section: Section;
  // 1-based position among the template's clips, and the total, for the "Clip N of M" eyebrow.
  clipNumber: number;
  totalClips: number;
  file: File | undefined;
  onFileChange: (file: File | undefined) => void;
  // Candidate takes for this section + the selected one. When `onAddRush` is supplied, recording or
  // uploading appends a take (instead of replacing) and the gallery lets the user pick the keeper.
  rushes?: File[];
  selectedRush?: File | undefined;
  onAddRush?: (file: File) => void;
  onSelectRush?: (file: File) => void;
  onRemoveRush?: (file: File) => void;
  edit: VideoEdit | undefined;
  onEditChange: (edit: VideoEdit | undefined) => void;
  // Variable map (global variables + colorN + form answers) used to resolve {{ tokens }} in the
  // section's title/description before they are shown.
  vars: Record<string, string | string[]>;
  // When false, render only the capture body — no centered header, no outer Card. The hub side sheet
  // supplies its own header/container, so the page chrome would just be a redundant card-in-card.
  chrome?: boolean;
  // When false, the trim/crop editor is not rendered here — the parent hosts it elsewhere (e.g. the
  // program monitor area of EditorShell so it has more horizontal space).
  showEditor?: boolean;
  // Template orientation — drives the camera frame + recording aspect (9:16 portrait, 1:1 square).
  orientation?: TemplateOrientation;
}

// The capture body shared by both chrome modes: the recorder/upload, the take gallery (when there's
// more than one take), and the inline trim/crop editor (when hosted here). Extracted so StepClip
// itself stays a thin frame.
const ClipCapture = ({
  section,
  file,
  onFileChange,
  rushes,
  selectedRush,
  onAddRush,
  onSelectRush,
  onRemoveRush,
  edit,
  onEditChange,
  hint,
  showEditor,
  orientation,
}: Pick<
  StepClipProps,
  | 'section'
  | 'file'
  | 'onFileChange'
  | 'rushes'
  | 'selectedRush'
  | 'onAddRush'
  | 'onSelectRush'
  | 'onRemoveRush'
  | 'edit'
  | 'onEditChange'
  | 'showEditor'
  | 'orientation'
> & { hint: string | undefined }) => {
  const { t } = useTranslation('builder');
  const rec = recordingConfigForSection(section);
  const takes = rushes ?? [];
  // A captured/uploaded clip is a new take: append it as a rush when the chooser is wired, otherwise
  // fall back to the single-clip replace behavior.
  const onCaptured = (captured: File | undefined) => {
    if (captured && onAddRush) onAddRush(captured);

    if (!onAddRush) onFileChange(captured);
  };
  const showChooser = takes.length > 1 && onSelectRush && onRemoveRush;
  // The recorder appends takes when wired to the gallery, so it stays empty (the gallery owns the
  // take list). Without the gallery it falls back to showing the single selected clip.
  const fallbackFiles = file ? [file] : [];

  return (
    <>
      <FileUpload
        onFilesUploaded={(files) => {
          onCaptured(files.at(-1));
        }}
        uploadedFiles={onAddRush ? [] : fallbackFiles}
        maxFiles={1}
        countdownSeconds={rec.countdownSeconds}
        maxDurationSeconds={rec.maxDurationSeconds}
        framingGuide={rec.framingGuide}
        description={hint}
        orientation={orientation}
        defaultCaptureMode={rec.defaultCaptureMode}
        allowedCaptureModes={rec.allowedCaptureModes}
      />
      {showChooser && (
        <RushChooser
          rushes={takes}
          selectedRush={selectedRush}
          onSelectRush={onSelectRush}
          onRemoveRush={onRemoveRush}
        />
      )}
      {showEditor && file && (
        <TimelineEditor file={file} label={t('stepClip.editorLabel')} edit={edit} onChange={onEditChange} />
      )}
    </>
  );
};

// One focused screen for a single clip: record-with-camera or upload, wired to THIS section's
// recording config (countdown/duration/framing/what-to-film). Captured takes collect in a gallery and
// the selected one feeds the trim/crop editor. Shared by both wizard modes (full chrome / bare sheet).
export const StepClip = ({
  section,
  clipNumber,
  totalClips,
  file,
  onFileChange,
  rushes = [],
  selectedRush,
  onAddRush,
  onSelectRush,
  onRemoveRush,
  edit,
  onEditChange,
  vars,
  chrome = true,
  showEditor = true,
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
    <ClipCapture
      section={section}
      file={file}
      onFileChange={onFileChange}
      rushes={rushes}
      selectedRush={selectedRush}
      onAddRush={onAddRush}
      onSelectRush={onSelectRush}
      onRemoveRush={onRemoveRush}
      edit={edit}
      onEditChange={onEditChange}
      hint={hint}
      showEditor={showEditor}
      orientation={orientation}
    />
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
