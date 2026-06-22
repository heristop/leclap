// Field block for a form section: an editable list of {id, label, maxLength} rows.
import { Plus, Trash2 } from '@/presentation/components/icons';
import { useTranslation } from 'react-i18next';
import { NumberField } from '@/presentation/components/ui/NumberField';
import type { EditorSection } from '../../templateEditorModel';

type FormSection = Extract<EditorSection, { kind: 'form' }>;
type FormField = FormSection['fields'][number];

interface FormFieldsProps {
  section: FormSection;
  onChange: (p: Partial<EditorSection>) => void;
  inputCls: string;
}

interface FieldRowProps {
  field: FormField;
  index: number;
  inputCls: string;
  onPatch: (patch: Partial<FormField>) => void;
  onRemove: () => void;
}

const FieldRow = ({ field, index, inputCls, onPatch, onRemove }: FieldRowProps) => {
  const { t } = useTranslation('admin');

  return (
    <div className="group grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center rounded-xl p-2 -mx-2 transition-colors hover:bg-foreground/[0.03]">
      <div className="flex flex-col gap-0.5">
        {index === 0 && (
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-gray-500 px-1 mb-0.5">
            {t('form.fieldId')}
          </span>
        )}
        <input
          aria-label={t('form.fieldId')}
          className={`${inputCls} font-mono text-[0.82rem]`}
          value={field.name}
          onChange={(e) => {
            onPatch({ name: e.target.value });
          }}
          placeholder={t('form.fieldIdPlaceholder')}
          spellCheck={false}
        />
      </div>

      <div className="flex flex-col gap-0.5">
        {index === 0 && (
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-gray-500 px-1 mb-0.5">
            {t('form.fieldLabel')}
          </span>
        )}
        <input
          aria-label={t('form.fieldLabel')}
          className={inputCls}
          value={field.label}
          onChange={(e) => {
            onPatch({ label: e.target.value });
          }}
          placeholder={t('form.fieldLabelPlaceholder')}
        />
      </div>

      <div className="flex flex-col gap-0.5">
        {index === 0 && (
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-gray-500 px-1 mb-0.5">
            {t('form.maxLength')}
          </span>
        )}
        <NumberField
          aria-label={t('form.maxLength')}
          value={field.maxLength}
          min={1}
          step={1}
          unit="ch"
          compact
          className="w-24"
          onChange={(maxLength) => {
            onPatch({ maxLength });
          }}
        />
      </div>

      <div className={index === 0 ? 'mt-[1.35rem]' : ''}>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('form.removeField')}
          className="tap rounded-lg p-1.5 text-gray-600 opacity-0 group-hover:opacity-100 hover:text-[var(--color-error)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const FormFields = ({ section, onChange, inputCls }: FormFieldsProps) => {
  const { t } = useTranslation('admin');

  const patchField = (index: number, patch: Partial<FormField>) => {
    onChange({ fields: section.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
  };

  return (
    <div className="space-y-0.5 pl-7">
      {section.fields.map((field, fi) => (
        <FieldRow
          key={fi}
          field={field}
          index={fi}
          inputCls={inputCls}
          onPatch={(patch) => {
            patchField(fi, patch);
          }}
          onRemove={() => {
            onChange({ fields: section.fields.filter((_, i) => i !== fi) });
          }}
        />
      ))}

      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            onChange({
              fields: [
                ...section.fields,
                { name: `field_${section.fields.length + 1}`, label: 'Label', maxLength: 40 },
              ],
            });
          }}
          className="tap inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-foreground/20 text-gray-500 hover:border-brand-500/50 hover:text-brand-400 hover:bg-brand-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] transition-all"
        >
          <Plus className="w-3 h-3" />
          {t('form.addField')}
        </button>
      </div>
    </div>
  );
};
