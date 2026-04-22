import { useState, useEffect, startTransition } from 'react'
import { Check, Play, Zap, Video, Users, Image, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { templateService, type Template } from '../services/templateService'
import { logger } from '../lib/logger'

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

export const TemplateSelector = ({
  onTemplateSelected,
  selectedTemplate
}: TemplateSelectorProps) => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true)
        const loadedTemplates = await templateService.getAllTemplates()
        setTemplates(loadedTemplates)
        setError(null)
      } catch (err) {
        logger.error('Failed to load templates:', err)
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
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-gray-800/50 rounded-xl border border-white/5"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-xl inline-block backdrop-blur-sm">
          <div className="text-red-400 mb-2 font-medium font-display text-lg">Failed to Load Templates</div>
          <p className="text-sm text-red-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-lg shadow-red-900/20 cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {templates.map((template) => {
          const IconComponent = getTemplateIcon(template)
          const isSelected = selectedTemplate?.id === template.id
          const formFields = templateService.extractFormFields(template.descriptor)

          return (
            <div
              key={template.id}
              className={clsx(
                'relative p-6 border rounded-xl cursor-pointer transition-all duration-300 fade-in group overflow-hidden backdrop-blur-sm',
                isSelected
                  ? 'border-brand-500 bg-brand-900/20 shadow-xl shadow-brand-500/10 scale-[1.02]'
                  : 'border-white/10 hover:border-brand-500/50 bg-gray-800/40 hover:bg-gray-800/60 hover:shadow-lg hover:shadow-brand-500/5'
              )}
              onClick={() => handleTemplateSelect(template)}
            >
              {/* Selection Ring Animation */}
              {isSelected && (
                <div className="absolute inset-0 border-2 border-brand-500 rounded-xl animate-pulse opacity-50 pointer-events-none" />
              )}

              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className={clsx(
                  'p-3 rounded-xl transition-colors duration-300 shadow-lg',
                  isSelected ? 'bg-brand-600 text-white shadow-brand-500/20' : 'bg-gray-700/50 text-gray-400 group-hover:bg-brand-500/20 group-hover:text-brand-400'
                )}>
                  <IconComponent className="w-8 h-8" />
                </div>

                <div className="flex flex-col items-end space-y-2">
                  <span className={clsx(
                    'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm',
                    complexityColors[template.complexity],
                    'text-white'
                  )}>
                    {template.complexity}
                  </span>
                  {isSelected && (
                    <span className="flex items-center text-brand-400 text-sm font-bold animate-in fade-in slide-in-from-right-4">
                      <Check className="w-4 h-4 mr-1" />
                      Selected
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="mb-6">
                <h3 className="text-2xl font-bold font-display text-white mb-2 group-hover:text-brand-400 transition-colors">
                  {template.name}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {template.description}
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-900/50 p-3 rounded-lg border border-white/5">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-1">Format</span>
                  <div className="flex items-center text-sm font-medium text-gray-200">
                    {template.orientation === 'portrait' ? (
                      <>
                        <Image className="w-4 h-4 mr-2 text-purple-400" />
                        Portrait (9:16)
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 mr-2 text-blue-400" />
                        Landscape (16:9)
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-gray-900/50 p-3 rounded-lg border border-white/5">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-1">Interactive</span>
                  <div className="flex items-center text-sm font-medium text-gray-200">
                    {template.hasForm ? (
                      <>
                        <Users className="w-4 h-4 mr-2 text-green-400" />
                        {formFields.length} Fields
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2 text-yellow-400" />
                        Auto-Process
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Capabilities */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex flex-wrap gap-2">
                  {template.descriptor.global.musicEnabled && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-900/30 text-pink-300 border border-pink-500/20">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Music
                    </span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700/50 text-gray-300 border border-white/10">
                    {template.descriptor.sections.length} Sections
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div >
  )
}