/// <reference types="vite/client" />
import { useState, useEffect, useId } from 'react'
import { FileText, User, Type, Hash } from 'lucide-react'
import clsx from 'clsx'
import { templateService, type Template } from '@/services/templateService'
import { Input } from '@/presentation/components/ui'

interface FormField {
  name: string
  label: Record<string, string>
  maxLength?: number
  type?: string
}

interface TemplateFormProps {
  template: Template
  onFormDataChange: (formData: Record<string, string>) => void
  formData: Record<string, string>
}

const getFieldIcon = (fieldName: string) => {
  if (fieldName.includes('name')) return User

  if (fieldName.includes('keyword')) return Hash

  return Type
}

const getFieldType = (field: FormField): 'text' | 'textarea' => {
  if (field.maxLength && field.maxLength > 50) return 'textarea'

  if (field.name.includes('description')) return 'textarea'

  return 'text'
}

const getFieldPlaceholder = (field: FormField): string => {
  const name = field.name.toLowerCase()

  if (name.includes('firstname')) return 'Enter your first name'

  if (name.includes('lastname')) return 'Enter your last name'

  if (name.includes('job')) return 'Your job title'

  if (name.includes('keyword')) return 'Enter a keyword'

  if (name.includes('description')) return 'Enter description...'

  const label = field.label.en || field.label.fr || Object.values(field.label)[0]

  return `Enter ${label.toLowerCase()}`
}

const computeFieldError = (field: FormField | undefined, value: string): string | null => {
  if (field?.maxLength && value.length > field.maxLength) {
    return `Maximum ${field.maxLength} characters allowed`
  }

  if (value.trim() === '') {
    return 'This field is required'
  }

  return null
}

interface FieldInputProps {
  field: FormField
  value: string
  hasError: boolean
  placeholder: string
  fieldId: string
  errorId: string
  onChange: (value: string) => void
}

const FieldInput = ({ field, value, hasError, placeholder, fieldId, errorId, onChange }: FieldInputProps) => {
  const fieldType = getFieldType(field)
  const errorClass = hasError
    ? 'border-[var(--color-error)]/50 bg-[var(--color-error)]/10 focus-visible:border-[var(--color-error)] focus-visible:ring-[var(--color-error)]/30'
    : ''

  if (fieldType === 'textarea') {
    return (
      <textarea
        id={fieldId}
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        placeholder={placeholder}
        maxLength={field.maxLength}
        rows={3}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={clsx(
          'w-full rounded-lg bg-surface-2 border border-divider px-3 py-2 text-foreground placeholder:text-gray-500 transition-all focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/30 resize-none',
          errorClass
        )}
      />
    )
  }

  return (
    <Input
      id={fieldId}
      type="text"
      value={value}
      onChange={(e) => { onChange(e.target.value); }}
      placeholder={placeholder}
      maxLength={field.maxLength}
      aria-invalid={hasError}
      aria-describedby={hasError ? errorId : undefined}
      className={errorClass}
    />
  )
}

interface FieldStatusProps {
  hasError: boolean
  errorMessage: string | undefined
  errorId: string
  value: string
  remainingChars: number | null
}

const FieldStatus = ({ hasError, errorMessage, errorId, value, remainingChars }: FieldStatusProps) => (
  <div className="flex justify-between items-center">
    {hasError ? (
      <span id={errorId} className="text-sm text-red-800 dark:text-red-400">{errorMessage}</span>
    ) : (
      <span className="text-sm text-gray-500">
        {value.trim() === '' ? 'Required field' : <span className="text-green-800 dark:text-green-400">Field completed ✓</span>}
      </span>
    )}

    {remainingChars !== null && (
      <span className={clsx(
        'text-xs',
        remainingChars < 10 ? 'text-red-800 dark:text-red-400' : 'text-gray-500'
      )}>
        {remainingChars} remaining
      </span>
    )}
  </div>
)

interface FormValidationSummaryProps {
  isValid: boolean
  fields: FormField[]
  formData: Record<string, string>
}

const FormValidationSummary = ({ isValid, fields, formData }: FormValidationSummaryProps) => (
  <div className={clsx(
    'p-4 rounded-xl border transition-all duration-300 backdrop-blur-sm',
    isValid
      ? 'bg-green-500/10 border-green-500/40 dark:bg-green-900/20 dark:border-green-500/30'
      : 'bg-yellow-500/10 border-yellow-500/40 dark:bg-yellow-900/20 dark:border-yellow-500/30'
  )}>
    <div className="flex items-center space-x-3">
      <div className={clsx(
        'p-2 rounded-lg shadow-lg',
        isValid ? 'bg-green-600 shadow-green-500/20' : 'bg-yellow-600 shadow-yellow-500/20'
      )}>
        <FileText className="w-4 h-4 text-white" />
      </div>
      <div>
        <h4 className={clsx(
          'font-semibold',
          isValid ? 'text-green-800 dark:text-green-400' : 'text-yellow-800 dark:text-yellow-400'
        )}>
          {isValid ? 'Form Complete!' : 'Form Incomplete'}
        </h4>
        <p className={clsx(
          'text-sm',
          isValid ? 'text-green-800/90 dark:text-green-200/70' : 'text-yellow-800/90 dark:text-yellow-200/70'
        )}>
          {isValid
            ? 'All required fields are filled. Ready to proceed.'
            : `Please fill in ${fields.filter(f => !formData[f.name]?.trim()).length} remaining field(s).`
          }
        </p>
      </div>
    </div>
  </div>
)

interface FormFieldItemProps {
  field: FormField
  index: number
  formData: Record<string, string>
  errors: Record<string, string>
  onFieldChange: (fieldName: string, value: string) => void
}

const FormFieldItem = ({ field, index, formData, errors, onFieldChange }: FormFieldItemProps) => {
  const fieldId = useId()
  const errorId = useId()
  const IconComponent = getFieldIcon(field.name)
  const placeholder = getFieldPlaceholder(field)
  const label = field.label.en || field.label.fr || Object.values(field.label)[0]
  const value = formData[field.name] || ''
  const hasError = Boolean(errors[field.name])
  const remainingChars = field.maxLength ? field.maxLength - value.length : null

  return (
    <div className="space-y-2 fade-in" style={{ animationDelay: `${index * 100}ms` }}>
      <label htmlFor={fieldId} className="flex items-center space-x-2 text-sm font-medium text-gray-300">
        <IconComponent className="w-4 h-4 text-blue-700 dark:text-blue-400" />
        <span>{label}</span>
        {field.maxLength && (
          <span className="text-xs text-gray-500">
            (max {field.maxLength} chars)
          </span>
        )}
      </label>

      <FieldInput
        field={field}
        value={value}
        hasError={hasError}
        placeholder={placeholder}
        fieldId={fieldId}
        errorId={errorId}
        onChange={(val) => { onFieldChange(field.name, val); }}
      />

      <FieldStatus
        hasError={hasError}
        errorMessage={errors[field.name]}
        errorId={errorId}
        value={value}
        remainingChars={remainingChars}
      />
    </div>
  )
}

const FormHeader = () => (
  <div className="text-center">
    <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl inline-block mb-4 shadow-lg shadow-blue-500/20">
      <FileText className="w-6 h-6 text-white" />
    </div>
    <h3 className="text-xl font-bold text-foreground mb-2 font-display">
      Template Configuration
    </h3>
    <p className="text-sm text-gray-400">
      Fill in the required information to personalize your video
    </p>
  </div>
)

export const TemplateForm = ({ template, onFormDataChange, formData }: TemplateFormProps) => {
  const [fields, setFields] = useState<FormField[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const extractedFields = templateService.extractFormFields(template.descriptor)
    setFields(extractedFields)
  }, [template])

  const handleFieldChange = (fieldName: string, value: string) => {
    const field = fields.find(f => f.name === fieldName)
    const newErrors = { ...errors }
    const errorMsg = computeFieldError(field, value)

    if (errorMsg !== null) {
      newErrors[fieldName] = errorMsg
      setErrors(newErrors)
      onFormDataChange({ ...formData, [fieldName]: value })

      return
    }

    delete newErrors[fieldName]
    setErrors(newErrors)
    onFormDataChange({ ...formData, [fieldName]: value })
  }

  const isFormValid = () => fields.every(field => {
    const value = formData[field.name] || ''

    return value.trim() !== '' && !errors[field.name]
  })

  if (fields.length === 0) {
    return (
      <div className="p-6 bg-blue-500/10 border border-blue-500/40 dark:bg-blue-900/20 dark:border-blue-500/30 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-800 dark:text-blue-300">No Form Required</h4>
            <p className="text-sm text-blue-800/90 dark:text-blue-200/70">
              This template doesn't require any custom input. You can proceed directly to processing.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <FormHeader />

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

      <FormValidationSummary
        isValid={isFormValid()}
        fields={fields}
        formData={formData}
      />
    </div>
  )
}
