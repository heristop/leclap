// Field block for a background-music section: the track media picker + an upload toggle.
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/presentation/components/ui';
import type { EditorSection } from '../../templateEditorModel';
import { MediaPicker } from '../../MediaPicker';
import { toggleId } from './toggleId';

type MusicSection = Extract<EditorSection, { kind: 'music' }>;

interface MusicFieldsProps {
  section: MusicSection;
  onChange: (p: Partial<EditorSection>) => void;
}

export const MusicFields = ({ section, onChange }: MusicFieldsProps) => {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-3 pl-7">
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('musicSection.pickTracks')}</p>
      <MediaPicker
        kind="music"
        multiple
        selectedIds={section.allowed}
        onToggleId={(id) => {
          onChange({ allowed: toggleId(section.allowed, id) });
        }}
      />
      <label className="flex w-fit items-center gap-2 text-sm text-gray-700 cursor-pointer select-none dark:text-gray-200">
        <Checkbox
          checked={section.allowUpload}
          onCheckedChange={(c) => {
            onChange({ allowUpload: c === true });
          }}
        />
        {t('musicSection.allowUpload')}
      </label>
    </div>
  );
};
