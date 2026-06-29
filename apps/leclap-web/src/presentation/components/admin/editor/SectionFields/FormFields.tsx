// Field block for a form section: a column header over an editable list of {id, label, maxLength} rows.
import { Trash2 } from '@/presentation/components/icons';
import { PlusIcon } from '@/presentation/components/icons/plus';
import { useTranslation } from 'react-i18next';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { NumberField } from '@/presentation/components/ui/NumberField';
import type { EditorSection } from '../../templateEditorModel';

type FormSection = Extract<EditorSection, { kind: 'form' }>;
type FormField = FormSection['fields'][number];

interface FormFieldsProps {
  section: FormSection;
  onChange: (p: Partial<EditorSection>) => void;
  inputCls: string;
}

// id | label | max-length | delete — one template shared by the header and every row so the columns
// line up. The max-length column is narrow (just a 2-digit counter) and the delete column is icon-sized.
const COLS = 'grid grid-cols-[1fr_1fr_5rem_1.75rem] gap-2';
const COL_LABEL = 'self-end px-1 text-[0.65rem] font-semibold uppercase leading-tight tracking-wider text-gray-500';
// One height for all three controls so the row reads as a single aligned set.
const FIELD_H = 'h-10';

const FieldHeader = () => {
  const { t } = useTranslation('admin');

  return (
    <div className={`${COLS} items-end px-2`}>
      <span className={COL_LABEL}>{t('form.fieldId')}</span>
      <span className={COL_LABEL}>{t('form.fieldLabel')}</span>
      <span className={COL_LABEL}>{t('form.maxLength')}</span>
      <span aria-hidden />
    </div>
  );
};

interface FieldRowProps {
  field: FormField;
  inputCls: string;
  onPatch: (patch: Partial<FormField>) => void;
  onRemove: () => void;
}

const FieldRow = ({ field, inputCls, onPatch, onRemove }: FieldRowProps) => {
  const { t } = useTranslation('admin');

  return (
    <div className={`group ${COLS} -mx-2 items-center rounded-xl p-2 transition-colors hover:bg-foreground/[0.03]`}>
      <input
        aria-label={t('form.fieldId')}
        className={`${inputCls} ${FIELD_H} font-mono text-[0.82rem]`}
        value={field.name}
        onChange={(e) => {
          onPatch({ name: e.target.value });
        }}
        placeholder={t('form.fieldIdPlaceholder')}
        spellCheck={false}
      />
      <input
        aria-label={t('form.fieldLabel')}
        className={`${inputCls} ${FIELD_H}`}
        value={field.label}
        onChange={(e) => {
          onPatch({ label: e.target.value });
        }}
        placeholder={t('form.fieldLabelPlaceholder')}
      />
      <NumberField
        aria-label={t('form.maxLength')}
        value={field.maxLength}
        min={1}
        step={1}
        unit="ch"
        compact
        className="w-full"
        inputCls={FIELD_H}
        onChange={(maxLength) => {
          onPatch({ maxLength });
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('form.removeField')}
        className="tap grid size-7 place-items-center rounded-lg text-gray-600 opacity-0 transition-all hover:text-[var(--color-error)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 group-hover:opacity-100 active:scale-90"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export const FormFields = ({ section, onChange, inputCls }: FormFieldsProps) => {
  const { t } = useTranslation('admin');
  const { ref: plusRef, hoverProps: plusHoverProps } = useIconHover();

  const patchField = (index: number, patch: Partial<FormField>) => {
    onChange({ fields: section.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
  };

  return (
    <div className="space-y-1.5 pl-7">
      <FieldHeader />

      <div className="space-y-0.5">
        {section.fields.map((field, fi) => (
          <FieldRow
            key={fi}
            field={field}
            inputCls={inputCls}
            onPatch={(patch) => {
              patchField(fi, patch);
            }}
            onRemove={() => {
              onChange({ fields: section.fields.filter((_, i) => i !== fi) });
            }}
          />
        ))}
      </div>

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
          className="tap inline-flex items-center gap-1.5 rounded-lg border border-dashed border-foreground/20 px-3 py-1.5 text-xs text-gray-500 transition-all hover:border-brand-500/50 hover:bg-brand-500/5 hover:text-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97]"
          {...plusHoverProps}
        >
          <PlusIcon ref={plusRef} size={12} />
          {t('form.addField')}
        </button>
      </div>
    </div>
  );
};
