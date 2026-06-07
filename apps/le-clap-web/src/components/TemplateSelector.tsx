import { useState, useEffect, startTransition } from 'react'
import { Check, Play, Zap, Video, Users, Image, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { templateService, type Template } from '../services/templateService'
import { logger } from '../lib/logger'

interface TemplateSelectorProps {
  onTemplateSelected: (template: Template) => void
  selectedTemplate: Template | null
}

interface TemplateCardProps {
  template: Template
  isSelected: boolean
  onSelect: (template: Template) => void
}

const getTemplateIcon = (template: Template) => {
  if (template.hasForm) return Users

  if (template.orientation === 'portrait') return Image

  if (template.complexity === 'simple') return Play

  if (template.complexity === 'advanced') return Zap

  return Video
}

const complexityColors = {
  simple: 'bg-brand-500 text-white',
  intermediate: 'bg-secondary-500 text-white',
  advanced: 'bg-accent-400 text-gray-900'
}

const TemplateCardHeader = ({
  template,
  isSelected
}: {
  template: Template
  isSelected: boolean
}) => {
  const IconComponent = getTemplateIcon(template)

  return (
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
          complexityColors[template.complexity]
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
  )
}

const TemplateCardFeatures = ({ template }: { template: Template }) => {
  const formFields = templateService.extractFormFields(template.descriptor)

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div className="bg-gray-900/50 p-3 rounded-lg border border-white/5">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-1">Format</span>
        <div className="flex items-center text-sm font-medium text-gray-200">
          {template.orientation === 'portrait' ? (
            <>
              <Image className="w-4 h-4 mr-2 text-secondary-300" />
              Portrait (9:16)
            </>
          ) : (
            <>
              <Video className="w-4 h-4 mr-2 text-brand-300" />
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
              <Users className="w-4 h-4 mr-2 text-brand-300" />
              {formFields.length} Fields
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2 text-accent-400" />
              Auto-Process
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const TemplateCard = ({ template, isSelected, onSelect }: TemplateCardProps) => (
  <div
    key={template.id}
    className={clsx(
      'tap relative p-6 border rounded-xl cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] fade-in group overflow-hidden backdrop-blur-sm',
      isSelected
        ? 'border-brand-500 bg-brand-900/20 shadow-xl shadow-brand-500/15 scale-[1.02]'
        : 'border-white/10 hover:border-brand-500/50 bg-gray-800/40 hover:bg-gray-800/60 hover:shadow-xl hover:shadow-brand-500/10 hover:-translate-y-1'
    )}
    onClick={() => { onSelect(template); }}
  >
    {isSelected && (
      <div className="absolute inset-0 border-2 border-brand-500 rounded-xl animate-pulse opacity-50 pointer-events-none" />
    )}

    <TemplateCardHeader template={template} isSelected={isSelected} />

    <div className="mb-6">
      <h3 className="text-2xl font-bold font-display text-white mb-2 group-hover:text-brand-400 transition-colors">
        {template.name}
      </h3>
      <p className="text-gray-400 leading-relaxed">
        {template.description}
      </p>
    </div>

    <TemplateCardFeatures template={template} />

    <div className="pt-4 border-t border-white/10">
      <div className="flex flex-wrap gap-2">
        {template.descriptor.global?.musicEnabled && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-500/15 text-secondary-300 border border-secondary-500/25">
            <Sparkles className="w-3 h-3 mr-1" />
            Music
          </span>
        )}
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700/50 text-gray-300 border border-white/10">
          {template.descriptor.sections?.length ?? 0} Sections
        </span>
      </div>
    </div>
  </div>
)

const LoadingSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid gap-6 md:grid-cols-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-64 bg-gray-800/50 rounded-xl border border-white/5" />
      ))}
    </div>
  </div>
)

const ErrorDisplay = ({ error }: { error: string }) => (
  <div className="text-center py-12">
    <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-xl inline-block backdrop-blur-sm">
      <div className="text-red-400 mb-2 font-medium font-display text-lg">Failed to Load Templates</div>
      <p className="text-sm text-red-300 mb-4">{error}</p>
      <button
        onClick={() => { window.location.reload(); }}
        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-lg shadow-red-900/20 cursor-pointer"
      >
        Retry Loading
      </button>
    </div>
  </div>
)

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
      } catch (error) {
        logger.error('Failed to load templates:', error)
        setError('Failed to load templates. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadTemplates().catch(() => {
      setError('Failed to load templates. Please try again.')
    })
  }, [])

  const handleTemplateSelect = (template: Template) => {
    startTransition(() => {
      onTemplateSelected(template)
    })
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return <ErrorDisplay error={error} />
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplate?.id === template.id}
            onSelect={handleTemplateSelect}
          />
        ))}
      </div>
    </div>
  )
}
