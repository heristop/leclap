import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Plus, Pencil, Trash2, Copy, Sparkles, FolderOpen, ArrowRight, Braces } from 'lucide-react';
import { templateService, type Template } from '@/services/templateService';
import { userTemplateService } from '@/services/userTemplateService';
import { Seo } from '@/presentation/components/Seo';
import { Badge, Button, Card, Reveal, type BadgeProps } from '@/presentation/components/ui';
import { logger } from '@/lib/logger';

const complexityBadgeVariant: Record<Template['complexity'], BadgeProps['variant']> = {
  simple: 'brand',
  intermediate: 'secondary',
  advanced: 'accent',
};

interface CardProps {
  template: Template;
  actions: React.ReactNode;
  t: TFunction<'admin'>;
}

const TemplateCard = ({ template, actions, t }: CardProps) => (
  <Card interactive className="flex h-full flex-col p-6">
    <div className="flex items-start justify-between gap-2 mb-2">
      <h3 className="text-lg font-bold font-display text-foreground">{template.name}</h3>
      <Badge variant={complexityBadgeVariant[template.complexity] ?? 'neutral'} className="shrink-0">
        {t(`complexity.${template.complexity}`)}
      </Badge>
    </div>
    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2.5rem]">
      {template.description || t('card.noDescription')}
    </p>
    <div className="mt-3 mb-5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span>{t(`orientationLabel.${template.orientation}`)}</span>
      <span className="text-foreground/25">•</span>
      <span>{t('card.section', { count: template.descriptor.sections?.length ?? 0 })}</span>
      {template.hasForm && (
        <>
          <span className="text-foreground/25">•</span>
          <span>{t('card.form')}</span>
        </>
      )}
    </div>
    <div className="mt-auto flex gap-2">{actions}</div>
  </Card>
);

export const Admin = () => {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    templateService
      .getAllTemplates()
      .then((all) => {
        setTemplates(all);
      })
      .catch((error: unknown) => {
        logger.error('Failed to load templates', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const samples = templates.filter((t) => t.source === 'sample');
  const mine = templates.filter((t) => t.source === 'user');

  const handleDuplicate = (template: Template) => {
    try {
      const copy = userTemplateService.duplicate(template);
      Promise.resolve(navigate(`/templates/${copy.id}/edit`)).catch(() => {});
    } catch (error) {
      logger.error('Duplicate failed', error);
    }
  };

  const handleDelete = (template: Template) => {
    userTemplateService.remove(template.id);
    refresh();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background bg-dots text-foreground relative overflow-hidden">
      <Seo title={t('templates.title', { ns: 'seo' })} path="/templates" noindex />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-16 relative z-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold font-display text-foreground mb-1">{t('page.heading')}</h1>
            <p className="text-gray-600 dark:text-gray-300">{t('page.subtitle')}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <aside className="space-y-3">
            <Button asChild className="w-full justify-start active:scale-[0.98]">
              <Link to="/templates/new">
                <Plus /> {t('page.create')}
              </Link>
            </Button>
            <Button asChild variant="secondary" className="w-full justify-start active:scale-[0.98]">
              <Link to="/partials">
                <Braces /> {t('page.partials')}
              </Link>
            </Button>
            <div className="space-y-1 rounded-xl border border-foreground/10 bg-surface/60 p-2">
              <a
                href="#my-templates"
                className="tap flex w-full items-center justify-between rounded-lg bg-brand-500/15 px-3 py-2 text-left text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-200"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <FolderOpen className="size-4 shrink-0" /> {t('page.myTemplates')}
                </span>
                <span className="shrink-0 text-xs opacity-75">{mine.length}</span>
              </a>
              <a
                href="#sample-templates"
                className="tap flex w-full items-center justify-between rounded-lg bg-foreground/5 px-3 py-2 text-left text-gray-600 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-gray-300"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4 shrink-0" /> {t('page.samples')}
                </span>
                <span className="shrink-0 text-xs opacity-75">{samples.length}</span>
              </a>
            </div>
            <Button asChild variant="outline" className="w-full justify-start active:scale-[0.98]">
              <Link to="/builder">
                {t('page.goToBuilder')} <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </aside>

          <div>
            {/* My templates */}
            <section id="my-templates" className="mb-12 scroll-mt-24">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300 mb-4">
                <FolderOpen className="w-4 h-4" /> {t('page.myTemplates')}{' '}
                {mine.length > 0 && <span className="text-gray-500">{t('page.count', { count: mine.length })}</span>}
              </h2>
              {mine.length === 0 ? (
                <div className="fade-in mx-auto max-w-md rounded-2xl border border-dashed border-brand-500/30 bg-brand-500/[0.04] p-10 text-center">
                  <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                    <FolderOpen className="size-6" />
                  </span>
                  <p className="text-foreground font-medium mb-1">{t('page.empty.title')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{t('page.empty.subtitle')}</p>
                  <Button asChild className="mx-auto active:scale-[0.98]">
                    <Link to="/templates/new">
                      <Plus /> {t('page.empty.create')}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {mine.map((tpl, index) => (
                    <Reveal key={tpl.id} delay={index * 70} className="h-full">
                      <TemplateCard
                        template={tpl}
                        t={t}
                        actions={
                          <>
                            <Button
                              asChild
                              variant="secondary"
                              size="sm"
                              className="min-h-10 flex-1 active:scale-[0.98]"
                            >
                              <Link to={`/templates/${tpl.id}/edit`}>
                                <Pencil /> {t('card.edit')}
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                handleDelete(tpl);
                              }}
                              aria-label={t('card.delete', { name: tpl.name })}
                              className="min-h-10 min-w-10 active:scale-[0.98] hover:text-[var(--color-error)]"
                            >
                              <Trash2 />
                            </Button>
                          </>
                        }
                      />
                    </Reveal>
                  ))}
                </div>
              )}
            </section>

            {/* Sample templates */}
            <section id="sample-templates" className="scroll-mt-24">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
                <Sparkles className="w-4 h-4" /> {t('page.samples')}
              </h2>
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-40 rounded-2xl border border-foreground/5 bg-surface/50 shimmer" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {samples.map((tpl, index) => (
                    <Reveal key={tpl.id} delay={index * 70} className="h-full">
                      <TemplateCard
                        template={tpl}
                        t={t}
                        actions={
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              handleDuplicate(tpl);
                            }}
                            className="min-h-10 flex-1 active:scale-[0.98]"
                          >
                            <Copy /> {t('card.duplicate')}
                          </Button>
                        }
                      />
                    </Reveal>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
