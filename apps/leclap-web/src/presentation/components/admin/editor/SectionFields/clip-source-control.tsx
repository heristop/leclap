// The scene-source toggle for a video section (camera vs fixed clip) and, in clip mode, the video
// picker. Split out of VideoFields so that panel stays focused on the per-scene essentials.
import { useTranslation } from 'react-i18next';
import type { EditorSection } from '../../templateEditorModel';
import { MediaPicker } from '../../MediaPicker';
import { SegmentedControl, type SegmentOption } from '../controls';

type VideoSection = Extract<EditorSection, { kind: 'video' }>;

export type ClipSource = 'camera' | 'clip';

interface ClipSourceControlProps {
  section: VideoSection;
  source: ClipSource;
  onSelectSource: (source: ClipSource) => void;
  onChange: (p: Partial<EditorSection>) => void;
}

export const ClipSourceControl = ({ section, source, onSelectSource, onChange }: ClipSourceControlProps) => {
  const { t } = useTranslation('admin');

  const sourceOptions: ReadonlyArray<SegmentOption<ClipSource>> = [
    { value: 'camera', label: t('video.sourceCamera') },
    { value: 'clip', label: t('video.sourceClip') },
  ];

  return (
    <>
      <div>
        <SegmentedControl label={t('video.source')} value={source} options={sourceOptions} onChange={onSelectSource} />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('video.sourceHint')}</span>
      </div>
      {source === 'clip' && (
        <MediaPicker
          kind="video"
          value={section.videoUrl ?? null}
          onChange={(choice) => {
            onChange({ videoUrl: choice ?? undefined });
          }}
        />
      )}
    </>
  );
};
