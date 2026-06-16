// Optional authoring metadata shared by visual background sections (color/image): a free-form Notes
// (description) field. It is UI-only — it identifies the scene in the builder and is never burned
// into the video. A blank value clears to undefined.
import { useTranslation } from 'react-i18next';

interface SceneMetaFieldsProps {
  description: string | undefined;
  onChange: (p: { description?: string }) => void;
  inputCls: string;
}

export const SceneMetaFields = ({ description, onChange, inputCls }: SceneMetaFieldsProps) => {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
          {t('scene.notes')}
        </span>
        <textarea
          value={description ?? ''}
          onChange={(e) => {
            const text = e.target.value;

            onChange({ description: text.trim() === '' ? undefined : text });
          }}
          rows={2}
          placeholder={t('scene.notesPlaceholder')}
          className={`${inputCls} resize-none`}
        />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('scene.notesHint')}</span>
      </label>
    </div>
  );
};
