// Field block for a form section: one compact card per field, then Add field. The label the viewer
// reads gets the full panel width on top; the variable id and the character cap share the row below.
// Laid out for the narrow editor panel — a four-column row there left every input three letters wide.
import { useId } from 'react';
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

// Small-caps control labels. `leading-tight` lets a long localized one ("Lunghezza massima") wrap onto
// two lines; the row aligns on the inputs' bottom edge, so the fields still line up.
const LABEL_CLS =
  'mb-1 block text-[0.65rem] font-semibold uppercase leading-tight tracking-wider text-muted-foreground';
// One height for all three controls so each card reads as an aligned set.
const FIELD_H = 'h-10';

interface FieldCardProps {
  field: FormField;
  inputCls: string;
  onPatch: (patch: Partial<FormField>) => void;
  onRemove: () => void;
}

const FieldCard = ({ field, inputCls, onPatch, onRemove }: FieldCardProps) => {
  const { t } = useTranslation('admin');
  const id = useId();

  return (
    <li className="rounded-xl border border-foreground/10 bg-surface-2/40 p-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-label`} className={LABEL_CLS}>
            {t('form.fieldLabel')}
          </label>
          <input
            id={`${id}-label`}
            className={`${inputCls} ${FIELD_H}`}
            value={field.label}
            onChange={(e) => {
              onPatch({ label: e.target.value });
            }}
            placeholder={t('form.fieldLabelPlaceholder')}
          />
        </div>
        {/* Always visible (dimmed) — a hover-only reveal is unreachable on touch screens. */}
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('form.removeField')}
          title={t('form.removeField')}
          className="tap grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-60 transition-all hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]/40 active:scale-90 motion-reduce:transition-none"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-2">
        <div className="min-w-0">
          <label htmlFor={`${id}-name`} className={LABEL_CLS}>
            {t('form.fieldId')}
          </label>
          <input
            id={`${id}-name`}
            className={`${inputCls} ${FIELD_H} font-mono text-[0.82rem]`}
            value={field.name}
            onChange={(e) => {
              onPatch({ name: e.target.value });
            }}
            placeholder={t('form.fieldIdPlaceholder')}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div>
          <label htmlFor={`${id}-max`} className={LABEL_CLS}>
            {t('form.maxLength')}
          </label>
          <NumberField
            id={`${id}-max`}
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
        </div>
      </div>
    </li>
  );
};

export const FormFields = ({ section, onChange, inputCls }: FormFieldsProps) => {
  const { t } = useTranslation('admin');
  const { ref: plusRef, hoverProps: plusHoverProps } = useIconHover();

  const patchField = (index: number, patch: Partial<FormField>) => {
    onChange({ fields: section.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {section.fields.map((field, fi) => (
          <FieldCard
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
      </ul>

      <button
        type="button"
        onClick={() => {
          onChange({
            fields: [
              ...section.fields,
              { name: `field_${section.fields.length + 1}`, label: t('form.fieldLabelPlaceholder'), maxLength: 40 },
            ],
          });
        }}
        className="tap inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-foreground/20 px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-brand-500/50 hover:bg-brand-500/5 hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.98] motion-reduce:transition-none"
        {...plusHoverProps}
      >
        <PlusIcon ref={plusRef} size={14} />
        {t('form.addField')}
      </button>
    </div>
  );
};
