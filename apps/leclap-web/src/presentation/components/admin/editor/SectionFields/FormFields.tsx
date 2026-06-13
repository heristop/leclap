// Field block for a form section: an editable list of {id, label, maxLength} rows.
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EditorSection } from '../../templateEditorModel';

type FormSection = Extract<EditorSection, { kind: 'form' }>;

interface FormFieldsProps {
  section: FormSection;
  onChange: (p: Partial<EditorSection>) => void;
  inputCls: string;
}

export const FormFields = ({ section, onChange, inputCls }: FormFieldsProps) => {
  const { t } = useTranslation('admin');

  const patchField = (index: number, patch: Partial<FormSection['fields'][number]>) => {
    onChange({ fields: section.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
  };

  return (
    <div className="space-y-2 pl-7">
      {section.fields.map((field, fi) => (
        <div key={fi} className="grid grid-cols-[1fr_1fr_5rem_auto] gap-2 items-center">
          <input
            aria-label={t('form.fieldId')}
            className={inputCls}
            value={field.name}
            onChange={(e) => {
              patchField(fi, { name: e.target.value });
            }}
            placeholder={t('form.fieldIdPlaceholder')}
          />
          <input
            aria-label={t('form.fieldLabel')}
            className={inputCls}
            value={field.label}
            onChange={(e) => {
              patchField(fi, { label: e.target.value });
            }}
            placeholder={t('form.fieldLabelPlaceholder')}
          />
          <input
            aria-label={t('form.maxLength')}
            type="number"
            className={inputCls}
            value={field.maxLength}
            onChange={(e) => {
              patchField(fi, { maxLength: Number(e.target.value) });
            }}
          />
          <button
            type="button"
            onClick={() => {
              onChange({ fields: section.fields.filter((_, i) => i !== fi) });
            }}
            aria-label={t('form.removeField')}
            className="tap rounded-lg p-1.5 text-gray-500 hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          onChange({
            fields: [...section.fields, { name: `field_${section.fields.length + 1}`, label: 'Label', maxLength: 40 }],
          });
        }}
        className="tap inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-foreground/5 text-gray-600 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] transition-colors dark:text-gray-300"
      >
        <Plus className="w-3.5 h-3.5" /> {t('form.addField')}
      </button>
    </div>
  );
};
