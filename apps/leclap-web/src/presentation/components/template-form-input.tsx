// One builder form input, picked by the field's control (template-form-fields.logic.ts): a declared colour
// gets the colour picker, a number the numeric field, an enum a select, a url/media a URL input; anything
// else keeps the text input / textarea it always had.
import clsx from 'clsx';
import {
  ColorPicker,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui';
import { NumberField } from '@/presentation/components/ui/NumberField';
import { fieldControl, type FormFieldModel } from './template-form-fields.logic';

export interface FieldInputProps {
  field: FormFieldModel;
  value: string;
  hasError: boolean;
  placeholder: string;
  fieldId: string;
  errorId: string;
  onChange: (value: string) => void;
}

const ERROR_CLASS =
  'border-[var(--color-error)]/50 bg-[var(--color-error)]/10 focus-visible:border-[var(--color-error)] focus-visible:outline-none';

// What an empty typed input shows: the template's default, so the viewer sees what they would get.
const shownValue = (field: FormFieldModel, value: string): string =>
  value === '' && field.contract?.default !== undefined ? String(field.contract.default) : value;

const TextArea = ({ field, value, hasError, placeholder, fieldId, errorId, onChange }: FieldInputProps) => (
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
      hasError ? ERROR_CLASS : 'field-focus-gradient border-divider bg-surface-2'
    )}
  />
);

const EnumSelect = ({ field, value, fieldId, placeholder, onChange }: FieldInputProps) => (
  <Select value={shownValue(field, value) || undefined} onValueChange={onChange}>
    <SelectTrigger id={fieldId}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {(field.contract?.options ?? []).map((option) => (
        <SelectItem key={option} value={option}>
          {option}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const NumberInput = ({ field, value, fieldId, onChange }: FieldInputProps) => {
  const parsed = Number(shownValue(field, value));

  return (
    <NumberField
      id={fieldId}
      value={Number.isFinite(parsed) ? parsed : 0}
      min={field.contract?.min}
      max={field.contract?.max}
      onChange={(next) => {
        onChange(String(next));
      }}
    />
  );
};

export const FieldInput = (props: FieldInputProps) => {
  const { field, value, hasError, placeholder, fieldId, errorId, onChange } = props;
  const control = fieldControl(field);

  if (control === 'textarea') return <TextArea {...props} />;

  if (control === 'select') return <EnumSelect {...props} />;

  if (control === 'number') return <NumberInput {...props} />;

  if (control === 'color') {
    return <ColorPicker id={fieldId} value={shownValue(field, value)} onChange={onChange} hideVariables />;
  }

  return (
    <Input
      id={fieldId}
      type={control === 'url' ? 'url' : 'text'}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      placeholder={field.contract?.default === undefined ? placeholder : String(field.contract.default)}
      maxLength={field.maxLength}
      aria-required
      aria-invalid={hasError}
      aria-describedby={hasError ? errorId : undefined}
      className={hasError ? ERROR_CLASS : ''}
    />
  );
};
