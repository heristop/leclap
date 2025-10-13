import { useState, useEffect } from 'react'
import { FileText, User, Type, Hash } from 'lucide-react'
import clsx from 'clsx'
import { templateService, type Template } from '../services/templateService'

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

    // Validate field
    if (field?.maxLength && value.length > field.maxLength) {
      newErrors[fieldName] = `Maximum ${field.maxLength} characters allowed`
    } else if (value.trim() === '') {
      newErrors[fieldName] = 'This field is required'
    } else {
      delete newErrors[fieldName]
    }

    setErrors(newErrors)

    // Update form data
    const newFormData = {
      ...formData,
      [fieldName]: value
    }
    onFormDataChange(newFormData)
  }

  const isFormValid = () => {
    return fields.every(field => {
      const value = formData[field.name] || ''
      return value.trim() !== '' && !errors[field.name]
    })
  }

  if (fields.length === 0) {
    return (
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-900">No Form Required</h4>
            <p className="text-sm text-blue-700">
              This template doesn't require any custom input. You can proceed directly to processing.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="p-3 bg-brand-500 rounded-lg inline-block mb-3">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Template Configuration
        </h3>
        <p className="text-sm text-gray-600">
          Fill in the required information to personalize your video
        </p>
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => {
          const IconComponent = getFieldIcon(field.name)
          const fieldType = getFieldType(field)
          const placeholder = getFieldPlaceholder(field)
          const label = field.label.en || field.label.fr || Object.values(field.label)[0]
          const value = formData[field.name] || ''
          const hasError = errors[field.name]
          const remainingChars = field.maxLength ? field.maxLength - value.length : null

          return (
            <div key={field.name} className="space-y-2 fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <IconComponent className="w-4 h-4 text-brand-600" />
                <span>{label}</span>
                {field.maxLength && (
                  <span className="text-xs text-gray-500">
                    (max {field.maxLength} chars)
                  </span>
                )}
              </label>

              {fieldType === 'textarea' ? (
                <textarea
                  value={value}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={placeholder}
                  maxLength={field.maxLength}
                  rows={3}
                  className={clsx(
                    'w-full px-4 py-3 border rounded-lg resize-none transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                    hasError
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 hover:border-brand-300'
                  )}
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={placeholder}
                  maxLength={field.maxLength}
                  className={clsx(
                    'w-full px-4 py-3 border rounded-lg transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                    hasError
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 hover:border-brand-300'
                  )}
                />
              )}

              <div className="flex justify-between items-center">
                {hasError ? (
                  <span className="text-sm text-red-600">{errors[field.name]}</span>
                ) : (
                  <span className="text-sm text-gray-500">
                    {value.trim() === '' ? 'Required field' : 'Field completed ✓'}
                  </span>
                )}

                {remainingChars !== null && (
                  <span className={clsx(
                    'text-xs',
                    remainingChars < 10 ? 'text-red-600' : 'text-gray-400'
                  )}>
                    {remainingChars} remaining
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Form Validation Summary */}
      <div className={clsx(
        'p-4 rounded-lg border transition-all duration-200',
        isFormValid()
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
      )}>
        <div className="flex items-center space-x-3">
          <div className={clsx(
            'p-2 rounded-lg',
            isFormValid() ? 'bg-green-500' : 'bg-yellow-500'
          )}>
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className={clsx(
              'font-semibold',
              isFormValid() ? 'text-green-900' : 'text-yellow-900'
            )}>
              {isFormValid() ? 'Form Complete!' : 'Form Incomplete'}
            </h4>
            <p className={clsx(
              'text-sm',
              isFormValid() ? 'text-green-700' : 'text-yellow-700'
            )}>
              {isFormValid()
                ? 'All required fields are filled. Ready to proceed with video processing.'
                : `Please fill in ${fields.filter(f => !formData[f.name]?.trim()).length} remaining field(s).`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Debug Info (Development) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="p-3 bg-gray-50 rounded-lg text-xs">
          <summary className="cursor-pointer font-medium text-gray-700 mb-2">
            Debug: Form Data
          </summary>
          <pre className="text-gray-600 overflow-auto">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}