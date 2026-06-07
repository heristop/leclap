import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Copy, Sparkles, FolderOpen, ArrowRight } from 'lucide-react'
import { templateService, type Template } from '@/services/templateService'
import { userTemplateService } from '@/services/userTemplateService'
import { TemplateEditor } from '@/presentation/components/admin/TemplateEditor'
import { Seo } from '@/presentation/components/Seo'
import { Badge, Button, Card, Reveal, type BadgeProps } from '@/presentation/components/ui'
import { logger } from '@/lib/logger'

const complexityBadgeVariant: Record<Template['complexity'], BadgeProps['variant']> = {
  simple: 'brand',
  intermediate: 'secondary',
  advanced: 'accent',
}

interface CardProps {
  template: Template
  actions: React.ReactNode
}

const TemplateCard = ({ template, actions }: CardProps) => (
  <Card interactive className="flex h-full flex-col p-6">
    <div className="flex items-start justify-between gap-2 mb-2">
      <h3 className="text-lg font-bold font-display text-foreground">{template.name}</h3>
      <Badge variant={complexityBadgeVariant[template.complexity] ?? 'neutral'} className="shrink-0">
        {template.complexity}
      </Badge>
    </div>
    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2.5rem]">{template.description || 'No description'}</p>
    <div className="mt-3 mb-5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span className="capitalize">{template.orientation}</span>
      <span className="text-foreground/25">•</span>
      <span>{template.descriptor.sections?.length ?? 0} section{(template.descriptor.sections?.length ?? 0) === 1 ? '' : 's'}</span>
      {template.hasForm && (<><span className="text-foreground/25">•</span><span>form</span></>)}
    </div>
    <div className="mt-auto flex gap-2">{actions}</div>
  </Card>
)

export const Admin = () => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ initial: Template | null } | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    templateService.getAllTemplates()
      .then((all) => { setTemplates(all) })
      .catch((error: unknown) => { logger.error('Failed to load templates', error) })
      .finally(() => { setLoading(false) })
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const samples = templates.filter((t) => t.source === 'sample')
  const mine = templates.filter((t) => t.source === 'user')

  const handleDuplicate = (template: Template) => {
    try {
      userTemplateService.duplicate(template)
      refresh()
    } catch (error) {
      logger.error('Duplicate failed', error)
    }
  }

  const handleDelete = (template: Template) => {
    userTemplateService.remove(template.id); refresh()
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background bg-dots text-foreground relative overflow-hidden">
      <Seo title="Admin" path="/admin" noindex />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-16 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-bold font-display text-foreground mb-1">Templates</h1>
            <p className="text-gray-600 dark:text-gray-300">Use a sample or craft your own — saved in this browser.</p>
          </div>
          <Button onClick={() => { setEditing({ initial: null }) }} className="active:scale-[0.98] shrink-0">
            <Plus /> Create template
          </Button>
        </div>

        {/* My templates */}
        <section className="mb-12">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300 mb-4">
            <FolderOpen className="w-4 h-4" /> My templates {mine.length > 0 && <span className="text-gray-500">({mine.length})</span>}
          </h2>
          {mine.length === 0 ? (
            <div className="fade-in mx-auto max-w-md rounded-2xl border border-dashed border-brand-500/30 bg-brand-500/[0.04] p-10 text-center">
              <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                <FolderOpen className="size-6" />
              </span>
              <p className="text-foreground font-medium mb-1">You haven't created any templates yet.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Start from scratch, or duplicate a sample below.</p>
              <Button onClick={() => { setEditing({ initial: null }) }} className="mx-auto active:scale-[0.98]">
                <Plus /> Create your first template
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((t, index) => (
                <Reveal key={t.id} delay={index * 70} className="h-full">
                  <TemplateCard template={t} actions={
                    <>
                      <Button variant="secondary" size="sm" onClick={() => { setEditing({ initial: t }) }} className="min-h-10 flex-1 active:scale-[0.98]"><Pencil /> Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => { handleDelete(t) }} aria-label={`Delete ${t.name}`} className="min-h-10 min-w-10 active:scale-[0.98] hover:text-[var(--color-error)]"><Trash2 /></Button>
                    </>
                  } />
                </Reveal>
              ))}
            </div>
          )}
        </section>

        {/* Sample templates */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
            <Sparkles className="w-4 h-4" /> Sample templates
          </h2>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl border border-foreground/5 bg-surface/50 shimmer" />)}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {samples.map((t, index) => (
                <Reveal key={t.id} delay={index * 70} className="h-full">
                  <TemplateCard template={t} actions={
                    <Button variant="secondary" size="sm" onClick={() => { handleDuplicate(t) }} className="min-h-10 flex-1 active:scale-[0.98]"><Copy /> Duplicate &amp; edit</Button>
                  } />
                </Reveal>
              ))}
            </div>
          )}
        </section>

        <div className="mt-12 text-center">
          <Link to="/builder" viewTransition className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 font-medium transition-colors">
            Go to the builder <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {editing && (
        <TemplateEditor
          initial={editing.initial}
          onSaved={() => { setEditing(null); refresh() }}
          onCancel={() => { setEditing(null) }}
        />
      )}
    </div>
  )
}
