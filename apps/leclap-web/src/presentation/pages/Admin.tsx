import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Plus, Pencil, Trash2, Copy, Sparkles, FolderOpen, ArrowRight, Braces } from '@/presentation/components/icons';
import { templateService, type Template } from '@/services/templateService';
import { userTemplateService } from '@/services/userTemplateService';
import { StudioSurface } from '@/presentation/components/StudioSurface';
import { TemplatePoster } from '@/presentation/components/TemplatePoster';
import { Seo } from '@/presentation/components/Seo';
import { Button, Card, Reveal } from '@/presentation/components/ui';
import { logger } from '@/lib/logger';

interface CardProps {
  template: Template;
  actions: React.ReactNode;
  t: TFunction<'admin'>;
}

// The poster-card language, shared with /studio: a seeded gradient band fronts a surface-2 card that
// lifts and spotlights on hover with a brand ring. The complexity tag lives on the poster, so the
// body carries the name, description and a compact meta line.
const TemplateCard = ({ template, actions, t }: CardProps) => (
  <Card
    onMouseMove={(e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
    }}
    className="lift spotlight group relative flex h-full flex-col overflow-hidden border-foreground/10 p-0 hover:border-brand-500/40"
  >
    <TemplatePoster template={template} />

    <div className="flex flex-1 flex-col p-5">
      <h3 className="mb-1.5 font-display text-lg font-bold text-foreground transition-colors group-hover:text-brand-300">
        {template.name}
      </h3>
      <p className="mb-4 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-gray-400">
        {template.description || t('card.noDescription')}
      </p>
      <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
        <span>{t(`orientationLabel.${template.orientation}`)}</span>
        <span aria-hidden className="text-foreground/25">
          ·
        </span>
        <span>{t('card.section', { count: template.descriptor.sections?.length ?? 0 })}</span>
        {template.hasForm && (
          <>
            <span aria-hidden className="text-foreground/25">
              ·
            </span>
            <span>{t('card.form')}</span>
          </>
        )}
      </div>
      <div className="mt-auto flex gap-2">{actions}</div>
    </div>
  </Card>
);

const SectionHeading = ({
  id,
  icon: Icon,
  label,
  count,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: string;
}) => (
  <h2
    id={id}
    className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-300/80"
  >
    <Icon className="size-4" /> {label}
    {count && <span className="text-gray-500">{count}</span>}
  </h2>
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

  const samples = templates.filter((entry) => entry.source === 'sample');
  const mine = templates.filter((entry) => entry.source === 'user');

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

  const actions = (
    <>
      <Button asChild variant="ghost" size="sm" className="active:scale-[0.98]">
        <Link to="/partials">
          <Braces /> {t('page.partials')}
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm" className="active:scale-[0.98]">
        <Link to="/studio">
          {t('page.goToBuilder')} <ArrowRight className="size-4" />
        </Link>
      </Button>
      <Button asChild className="active:scale-[0.98]">
        <Link to="/templates/new">
          <Plus /> {t('page.create')}
        </Link>
      </Button>
    </>
  );

  return (
    <StudioSurface title={t('page.heading')} subtitle={t('page.subtitle')} actions={actions}>
      <Seo title={t('templates.title', { ns: 'seo' })} path="/templates" noindex />

      <section aria-labelledby="my-templates" className="mb-14 scroll-mt-24">
        <SectionHeading
          id="my-templates"
          icon={FolderOpen}
          label={t('page.myTemplates')}
          count={mine.length > 0 ? t('page.count', { count: mine.length }) : undefined}
        />
        {mine.length === 0 ? (
          <div className="fade-in mx-auto max-w-md rounded-2xl border border-dashed border-brand-500/30 bg-brand-500/[0.06] p-10 text-center motion-reduce:animate-none">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-500/15 text-brand-300">
              <FolderOpen className="size-6" />
            </span>
            <p className="mb-1 font-medium text-foreground">{t('page.empty.title')}</p>
            <p className="mb-5 text-sm text-gray-400">{t('page.empty.subtitle')}</p>
            <Button asChild className="mx-auto active:scale-[0.98]">
              <Link to="/templates/new">
                <Plus /> {t('page.empty.create')}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((tpl, index) => (
              <Reveal key={tpl.id} delay={index * 70} className="h-full">
                <TemplateCard
                  template={tpl}
                  t={t}
                  actions={
                    <>
                      <Button asChild variant="secondary" size="sm" className="min-h-10 flex-1 active:scale-[0.98]">
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
                        className="min-h-10 min-w-10 text-gray-400 active:scale-[0.98] hover:text-[var(--color-error)]"
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

      <section aria-labelledby="sample-templates" className="scroll-mt-24">
        <SectionHeading id="sample-templates" icon={Sparkles} label={t('page.samples')} />
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-2xl border border-foreground/5 bg-surface-2/50 shimmer" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
    </StudioSurface>
  );
};
