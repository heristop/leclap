/// <reference types="vite/client" />
import { useState, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { FileText, User, Type, Hash, Check } from '@/presentation/components/icons';
import clsx from 'clsx';
import { templateService, type Template } from '@/services/templateService';
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
  if (fieldName.includes('name')) return User;

  if (fieldName.includes('keyword')) return Hash;

  return Type;
};

const getFieldType = (field: FormField): 'text' | 'textarea' => {
  if (field.maxLength && field.maxLength > 50) return 'textarea';

  if (field.name.includes('description')) return 'textarea';

  return 'text';
};

const getFieldPlaceholder = (field: FormField, t: TFunction<'templates'>): string => {
  const name = field.name.toLowerCase();

  if (name.includes('firstname')) return t('form.placeholder.firstName');

  if (name.includes('lastname')) return t('form.placeholder.lastName');

  if (name.includes('job')) return t('form.placeholder.job');

  if (name.includes('keyword')) return t('form.placeholder.keyword');

  if (name.includes('description')) return t('form.placeholder.description');

  const label = field.label.en || field.label.fr || Object.values(field.label)[0];

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
    ? 'border-[var(--color-error)]/50 bg-[var(--color-error)]/10 focus-visible:border-[var(--color-error)] focus-visible:ring-[var(--color-error)]/30'
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
          'w-full rounded-lg bg-surface-2 border border-divider px-3 py-2 text-foreground placeholder:text-gray-500 transition-all focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/30 resize-none',
          errorClass
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

const FieldStatus = ({ hasError, errorMessage, errorId, value, charCount, maxChars }: FieldStatusProps) => {
  const { t } = useTranslation('templates');
  const nearLimit = maxChars !== null && maxChars - charCount < 10;

  return (
    <div className="flex justify-between items-center">
      {hasError ? (
        <span id={errorId} className="text-sm text-red-800 dark:text-red-400">
          {errorMessage}
        </span>
      ) : (
        <span className="text-sm text-gray-500">
          {value.trim() === '' ? (
            t('form.status.required')
          ) : (
            <span className="inline-flex items-center gap-1 text-green-800 dark:text-green-400">
              <Check className="w-3.5 h-3.5" /> {t('form.status.completed')}
            </span>
          )}
        </span>
      )}

      {maxChars !== null && (
        <span className={clsx('text-xs tabular-nums', nearLimit ? 'text-red-800 dark:text-red-400' : 'text-gray-500')}>
          {t('form.status.counter', { count: charCount, max: maxChars })}
        </span>
      )}
    </div>
  );
};

interface FormValidationSummaryProps {
  isValid: boolean;
  fields: FormField[];
  formData: Record<string, string>;
}

const FormValidationSummary = ({ isValid, fields, formData }: FormValidationSummaryProps) => {
  const { t } = useTranslation('templates');
  const remaining = fields.filter((f) => !formData[f.name]?.trim()).length;

  return (
    <div
      className={clsx(
        'p-4 rounded-xl border transition-all duration-300 backdrop-blur-sm',
        isValid
          ? 'bg-green-500/10 border-green-500/40 dark:bg-green-900/20 dark:border-green-500/30'
          : 'bg-yellow-500/10 border-yellow-500/40 dark:bg-yellow-900/20 dark:border-yellow-500/30'
      )}
    >
      <div className="flex items-center space-x-3">
        <div
          className={clsx(
            'p-2 rounded-lg shadow-lg',
            isValid ? 'bg-green-600 shadow-green-500/20' : 'bg-yellow-600 shadow-yellow-500/20'
          )}
        >
          <FileText className="w-4 h-4 text-white" />
        </div>
        <div>
          <h4
            className={clsx(
              'font-semibold',
              isValid ? 'text-green-800 dark:text-green-400' : 'text-yellow-800 dark:text-yellow-400'
            )}
          >
            {isValid ? t('form.validation.completeTitle') : t('form.validation.incompleteTitle')}
          </h4>
          <p
            className={clsx(
              'text-sm',
              isValid ? 'text-green-800/90 dark:text-green-200/70' : 'text-yellow-800/90 dark:text-yellow-200/70'
            )}
          >
            {isValid
              ? t('form.validation.completeMessage')
              : t('form.validation.incompleteMessage', { count: remaining })}
          </p>
        </div>
      </div>
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
  const { t } = useTranslation('templates');
  const fieldId = useId();
  const errorId = useId();
  const IconComponent = getFieldIcon(field.name);
  const placeholder = getFieldPlaceholder(field, t);
  const label = field.label.en || field.label.fr || Object.values(field.label)[0];
  const value = formData[field.name] || '';
  const hasError = Boolean(errors[field.name]);
  const maxChars = field.maxLength ?? null;

  return (
    <div className="space-y-2 fade-in" style={{ animationDelay: `${index * 100}ms` }}>
      <label
        htmlFor={fieldId}
        className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <IconComponent className="w-4 h-4 text-brand-600 dark:text-brand-300" />
        <span>{label}</span>
        <span className="text-brand-600 dark:text-brand-300" aria-label={t('form.status.requiredMark')}>
          *
        </span>
        {field.maxLength && (
          <span className="text-xs text-gray-500">{t('form.status.maxCharsLabel', { count: field.maxLength })}</span>
        )}
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
        <FileText className="w-6 h-6 text-white" />
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

  const isFormValid = () =>
    fields.every((field) => {
      const value = formData[field.name] || '';

      return value.trim() !== '' && !errors[field.name];
    });

  if (fields.length === 0) {
    return (
      <div className="fade-in p-6 bg-brand-500/[0.06] border border-brand-500/30 dark:bg-brand-500/10 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="brand-gradient p-2 rounded-lg shadow-lg shadow-brand-500/20">
            <FileText className="w-5 h-5 text-white" />
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

      <div className="space-y-6">
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

      <FormValidationSummary isValid={isFormValid()} fields={fields} formData={formData} />
    </div>
  );
};
