import { useState, useEffect, startTransition } from 'react'
import { Check, Play, Settings, Zap, Video, Users, Image } from 'lucide-react'
import clsx from 'clsx'
import { templateService, type Template } from '../services/templateService'

interface TemplateSelectorProps {
  onTemplateSelected: (template: Template) => void
  selectedTemplate: Template | null
}

const getTemplateIcon = (template: Template) => {
  if (template.hasForm) return Users
  if (template.orientation === 'portrait') return Image
  if (template.complexity === 'simple') return Play
  if (template.complexity === 'advanced') return Zap
  return Video
}

const complexityColors = {
  simple: 'bg-blue-500',
  intermediate: 'bg-purple-500',
  advanced: 'bg-green-500'
}

const orientationColors = {
  landscape: 'text-blue-600 bg-blue-100',
  portrait: 'text-purple-600 bg-purple-100'
}

export const TemplateSelector = ({
  onTemplateSelected,
  selectedTemplate
}: TemplateSelectorProps) => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null)

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true)
        const loadedTemplates = await templateService.getAllTemplates()
        setTemplates(loadedTemplates)
        setError(null)
      } catch (err) {
        console.error('Failed to load templates:', err)
        setError('Failed to load templates. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadTemplates()
  }, [])

  const handleTemplateSelect = (template: Template) => {
    startTransition(() => {
      onTemplateSelected(template)
    })
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="text-center mb-6">
          <div className="h-6 bg-gray-200 rounded w-48 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64 mx-auto"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 border-2 border-gray-200 rounded-xl">
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-600 mb-2 font-medium">Failed to Load Templates</div>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="block mx-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry Loading
            </button>
            <p className="text-xs text-red-600">
              Make sure the server is running on localhost:3000
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Choose Your Video Template
        </h3>
        <p className="text-sm text-gray-600">
          Select from real templates with advanced video processing capabilities
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => {
          const IconComponent = getTemplateIcon(template)
          const isSelected = selectedTemplate?.id === template.id
          const isHovered = hoveredTemplate === template.id
          const formFields = templateService.extractFormFields(template.descriptor)

          return (
            <div
              key={template.id}
              className={clsx(
                'relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 fade-in',
                'hover:shadow-lg hover:scale-[1.02] group',
                isSelected
                  ? 'border-brand-500 bg-brand-50 shadow-lg scale-[1.02]'
                  : 'border-gray-200 hover:border-brand-300 bg-white'
              )}
              onClick={() => handleTemplateSelect(template)}
              onMouseEnter={() => setHoveredTemplate(template.id)}
              onMouseLeave={() => setHoveredTemplate(null)}
            >
              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Complexity and Orientation Badges */}
              <div className="flex items-center justify-between mb-3">
                <span className={clsx(
                  'px-2 py-1 rounded-full text-xs font-medium text-white capitalize',
                  complexityColors[template.complexity]
                )}>
                  {template.complexity}
                </span>
                <div className="flex items-center space-x-2">
                  <span className={clsx(
                    'px-2 py-1 rounded-full text-xs font-medium capitalize',
                    orientationColors[template.orientation]
                  )}>
                    {template.orientation}
                  </span>
                  {template.hasForm && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
                      Interactive
                    </span>
                  )}
                </div>
              </div>

              {/* Template Icon and Title */}
              <div className="flex items-start space-x-3 mb-3">
                <div className={clsx(
                  'p-3 rounded-lg transition-all duration-200',
                  isSelected ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600',
                  isHovered && !isSelected && 'bg-brand-100 text-brand-600'
                )}>
                  <IconComponent className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {template.name}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {template.description}
                  </p>
                </div>
              </div>

              {/* Template Info */}
              <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Sections:</span>
                    <span className="ml-1 font-mono text-gray-700">
                      {template.descriptor.sections.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Forms:</span>
                    <span className="ml-1 font-mono text-gray-700">
                      {formFields.length} fields
                    </span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700 flex items-center">
                  <Settings className="w-3 h-3 mr-1" />
                  Capabilities:
                </p>
                <ul className="space-y-1">
                  {template.descriptor.global.musicEnabled && (
                    <li className="flex items-center text-xs text-gray-600">
                      <div className="w-1 h-1 bg-brand-500 rounded-full mr-2"></div>
                      Background Music
                    </li>
                  )}
                  {formFields.length > 0 && (
                    <li className="flex items-center text-xs text-gray-600">
                      <div className="w-1 h-1 bg-brand-500 rounded-full mr-2"></div>
                      Custom Text Input
                    </li>
                  )}
                  <li className="flex items-center text-xs text-gray-600">
                    <div className="w-1 h-1 bg-brand-500 rounded-full mr-2"></div>
                    {template.orientation === 'portrait' ? 'Mobile Optimized' : 'Wide Screen'}
                  </li>
                  <li className="flex items-center text-xs text-gray-600">
                    <div className="w-1 h-1 bg-brand-500 rounded-full mr-2"></div>
                    Advanced Effects
                  </li>
                </ul>
              </div>

              {/* Hover Effect */}
              <div className={clsx(
                'absolute inset-0 rounded-xl bg-gradient-to-r from-brand-500/5 to-purple-500/5 opacity-0 transition-opacity duration-200',
                (isHovered || isSelected) && 'opacity-100'
              )} />
            </div>
          )
        })}
      </div>

      {/* Selected Template Summary */}
      {selectedTemplate && (
        <div className="mt-6 p-4 bg-gradient-to-r from-brand-50 to-purple-50 rounded-lg border border-brand-200 fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-500 rounded-lg">
              <Check className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-brand-900">
                Selected: {selectedTemplate.name}
              </h4>
              <p className="text-sm text-brand-700">
                Ready to process with {selectedTemplate.complexity} complexity template
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}