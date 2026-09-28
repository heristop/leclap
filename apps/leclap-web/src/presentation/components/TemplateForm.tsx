/// <reference types="vite/client" />
import { useState, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Type, Hash, Check } from '@/presentation/components/icons';
import { FileTextIcon } from '@/presentation/components/icons/file-text';
import { UserIcon } from '@/presentation/components/icons/user';
import clsx from 'clsx';
import { templateService, type Template } from '@/services/templateService';
import { resolveTranslation } from '@/lib/i18nText';
import { Input } from '@/presentation/components/ui';

interface FormField {
  name: string;
  label: Record<string, string>;
  maxLength?: number;
  type?: string;
}

interface TemplateFormProps {
  template: Template;
  onFormDataChange: (formData: Record<string, string>) => void;
  formData: Record<string, string>;
  // When set, render only THIS form section's fields (the per-section wizard step). Omit for the
  // legacy all-fields-at-once form. When scoped, the generic header is hidden (the step supplies one).
  sectionName?: string;
}

const getFieldIcon = (fieldName: string) => {
  if (fieldName.includes('name')) return UserIcon;

  if (fieldName.includes('keyword')) return Hash;

  return Type;
};

const getFieldType = (field: FormField): 'text' | 'textarea' => {
  if (field.maxLength && field.maxLength > 50) return 'textarea';

  if (field.name.includes('description')) return 'textarea';

  return 'text';
};

const getFieldPlaceholder = (field: FormField, label: string, t: TFunction<'templates'>): string => {
  const name = field.name.toLowerCase();

  if (name.includes('firstname')) return t('form.placeholder.firstName');

  if (name.includes('lastname')) return t('form.placeholder.lastName');

  if (name.includes('job')) return t('form.placeholder.job');

  if (name.includes('keyword')) return t('form.placeholder.keyword');

  if (name.includes('description')) return t('form.placeholder.description');

  return t('form.placeholder.generic', { label: label.toLowerCase() });
};

const computeFieldError = (field: FormField | undefined, value: string, t: TFunction<'templates'>): string | null => {
  if (field?.maxLength && value.length > field.maxLength) {
    return t('form.status.maxChars', { count: field.maxLength });
  }

  if (value.trim() === '') {
    return t('form.status.fieldRequired');
  }

  return null;
};

interface FieldInputProps {
  field: FormField;
  value: string;
  hasError: boolean;
  placeholder: string;
  fieldId: string;
  errorId: string;
  onChange: (value: string) => void;
}

const FieldInput = ({ field, value, hasError, placeholder, fieldId, errorId, onChange }: FieldInputProps) => {
  const fieldType = getFieldType(field);
  const errorClass = hasError
    ? 'border-[var(--color-error)]/50 bg-[var(--color-error)]/10 focus-visible:border-[var(--color-error)] focus-visible:outline-none'
    : '';

  if (fieldType === 'textarea') {
    return (
      <textarea
        id={fieldId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        maxLength={field.maxLength}
        rows={3}
        aria-required
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={clsx(
          'w-full resize-none rounded-lg border px-3 py-2 text-foreground placeholder:text-gray-500 transition-colors focus-visible:outline-none',
          hasError ? errorClass : 'field-focus-gradient border-divider bg-surface-2'
        )}
      />
    );
  }

  return (
    <Input
      id={fieldId}
      type="text"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      placeholder={placeholder}
      maxLength={field.maxLength}
      aria-required
      aria-invalid={hasError}
      aria-describedby={hasError ? errorId : undefined}
      className={errorClass}
    />
  );
};

interface FieldStatusProps {
  hasError: boolean;
  errorMessage: string | undefined;
  errorId: string;
  value: string;
  charCount: number;
  maxChars: number | null;
}

// The line under a field says only what the field itself doesn't: an error when there is one, a quiet
// check once it's filled, and the character budget. "Required field" under every empty input (with the
// asterisk already on its label) and a "Form complete!" banner below them (with the scene's own check
// and the titlebar meter already counting) were the same fact said three times.
const FieldStatus = ({ hasError, errorMessage, errorId, value, charCount, maxChars }: FieldStatusProps) => {
  const { t } = useTranslation('templates');
  const nearLimit = maxChars !== null && maxChars - charCount < 10;
  const filled = value.trim() !== '';

  return (
    <div className="flex min-h-5 items-center justify-between gap-3">
      {hasError && (
        <span id={errorId} className="text-sm text-[var(--color-error)]">
          {errorMessage}
        </span>
      )}
      {!hasError && filled && (
        <span role="img" aria-label={t('form.status.completed')} className="inline-flex text-success-foreground">
          <Check className="size-4" aria-hidden="true" />
        </span>
      )}
      {!hasError && !filled && <span />}

      {maxChars !== null && (
        <span className={clsx('text-xs tabular-nums', nearLimit ? 'text-[var(--color-error)]' : 'text-gray-500')}>
          {t('form.status.counter', { count: charCount, max: maxChars })}
        </span>
      )}
    </div>
  );
};

interface FormFieldItemProps {
  field: FormField;
  index: number;
  formData: Record<string, string>;
  errors: Record<string, string>;
  onFieldChange: (fieldName: string, value: string) => void;
}

const FormFieldItem = ({ field, index, formData, errors, onFieldChange }: FormFieldItemProps) => {
  const { t, i18n } = useTranslation('templates');
  const fieldId = useId();
  const errorId = useId();
  const IconComponent = getFieldIcon(field.name);
  // The author's label in the viewer's language, when the template carries one.
  const label = resolveTranslation(field.label, i18n.language) ?? field.name;
  const placeholder = getFieldPlaceholder(field, label, t);
  const value = formData[field.name] || '';
  const hasError = Boolean(errors[field.name]);
  const maxChars = field.maxLength ?? null;

  return (
    <div className="space-y-2 fade-in" style={{ animationDelay: `${index * 100}ms` }}>
      {/* The character budget lives in the counter under the field, not repeated beside the label. */}
      <label
        htmlFor={fieldId}
        className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <IconComponent className="w-4 h-4 text-brand-600 dark:text-brand-300" />
        <span>{label}</span>
        <span className="text-brand-600 dark:text-brand-300" aria-label={t('form.status.requiredMark')}>
          *
        </span>
      </label>

      <FieldInput
        field={field}
        value={value}
        hasError={hasError}
        placeholder={placeholder}
        fieldId={fieldId}
        errorId={errorId}
        onChange={(val) => {
          onFieldChange(field.name, val);
        }}
      />

      <FieldStatus
        hasError={hasError}
        errorMessage={errors[field.name]}
        errorId={errorId}
        value={value}
        charCount={value.length}
        maxChars={maxChars}
      />
    </div>
  );
};

const FormHeader = () => {
  const { t } = useTranslation('templates');

  return (
    <div className="text-center">
      <div className="brand-gradient rise-in p-3 rounded-2xl inline-block mb-4 shadow-lg shadow-brand-500/25">
        <FileTextIcon size={24} className="text-white" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2 font-display">{t('form.header.title')}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('form.header.subtitle')}</p>
    </div>
  );
};

export const TemplateForm = ({ template, onFormDataChange, formData, sectionName }: TemplateFormProps) => {
  const { t } = useTranslation('templates');
  const [fields, setFields] = useState<FormField[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const extractedFields = sectionName
      ? templateService.extractFormFieldsForSection(template.descriptor, sectionName)
      : templateService.extractFormFields(template.descriptor);
    setFields(extractedFields);
  }, [template, sectionName]);

  const handleFieldChange = (fieldName: string, value: string) => {
    const field = fields.find((f) => f.name === fieldName);
    const newErrors = { ...errors };
    const errorMsg = computeFieldError(field, value, t);

    if (errorMsg !== null) {
      newErrors[fieldName] = errorMsg;
      setErrors(newErrors);
      onFormDataChange({ ...formData, [fieldName]: value });

      return;
    }

    delete newErrors[fieldName];
    setErrors(newErrors);
    onFormDataChange({ ...formData, [fieldName]: value });
  };

  if (fields.length === 0) {
    return (
      <div className="fade-in p-6 bg-brand-500/[0.06] border border-brand-500/30 dark:bg-brand-500/10 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="brand-gradient p-2 rounded-lg shadow-lg shadow-brand-500/20">
            <FileTextIcon size={20} className="text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-brand-700 dark:text-brand-200">{t('form.noForm.title')}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('form.noForm.message')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!sectionName && <FormHeader />}

      <div className="space-y-5">
        {fields.map((field, index) => (
          <FormFieldItem
            key={field.name}
            field={field}
            index={index}
            formData={formData}
            errors={errors}
            onFieldChange={handleFieldChange}
          />
        ))}
      </div>
    </div>
  );
};
