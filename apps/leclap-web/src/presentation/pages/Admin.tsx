import { useEffect, useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Pencil, Trash2, ArrowRight, Braces, Scissors, Check } from '@/presentation/components/icons';
import { ArrowRightIcon } from '@/presentation/components/icons/arrow-right';
import { PlusIcon } from '@/presentation/components/icons/plus';
import { SparklesIcon } from '@/presentation/components/icons/sparkles';
import { FolderOpenIcon } from '@/presentation/components/icons/folder-open';
import { cn } from '@/lib/utils';
import { CopyIcon } from '@/presentation/components/icons/copy';
import { GithubIcon } from '@/presentation/components/icons/github';
import {
  Button,
  Card,
  Reveal,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { templateService, type Template } from '@/services/templateService';
import { userTemplateService } from '@/services/userTemplateService';
import { templateToPartial } from '@/lib/templateToPartial';
import { StudioSurface } from '@/presentation/components/StudioSurface';
import { TemplatePoster } from '@/presentation/components/TemplatePoster';
import { Seo } from '@/presentation/components/Seo';
import { logger } from '@/lib/logger';

interface CardProps {
  template: Template;
  actions: React.ReactNode;
  t: TFunction<'admin'>;
}

// "Duplicate & edit" action whose copy icon animates on hover of the whole button (group hover), driven
// from the button via the icon's imperative handle (the Button suppresses the glyph's own pointer events).
const DuplicateButton = ({ label, onClick }: { label: string; onClick: () => void }) => {
  const { ref, hoverProps } = useIconHover();

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      {...hoverProps}
      className="min-h-10 flex-1 active:scale-[0.98]"
    >
      <CopyIcon ref={ref} /> {label}
    </Button>
  );
};

// Mark this card's title as the View Transition's shared element so it morphs into the editor titlebar
// when the template editor opens. Called from the edit link's click: walk up to the card, then tag its
// title — set imperatively at click time so the name is on the DOM before the snapshot.
const tagTitleForTransition = (link: HTMLElement): void => {
  const title = link.closest('[data-vt-card]')?.querySelector<HTMLElement>('[data-vt-title]');

  if (title) title.style.viewTransitionName = 'studio-title';
};

// The poster-card language, shared with /studio: a seeded gradient band fronts a surface-2 card that
// lifts and spotlights on hover with a brand ring. The complexity tag lives on the poster, so the
// body carries the name, description and a compact meta line.
const TemplateCard = ({ template, actions, t }: CardProps) => (
  <Card
    data-vt-card
    onMouseMove={(e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
    }}
    className="lift spotlight group relative flex h-full flex-col overflow-hidden border-foreground/10 p-0 hover:border-brand-500/40"
  >
    <TemplatePoster template={template} />

    <div className="flex flex-1 flex-col p-5">
      <h3
        data-vt-title
        className="mb-1.5 font-display text-lg font-bold text-foreground transition-colors group-hover:text-brand-300"
      >
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

const GITHUB_REPO = 'https://github.com/heristop/leclap';

// Per-card row actions (duplicate / delete / convert-to-partial / copy JSON), grouped into a hook to
// keep them out of the page component. State + navigation are passed in.
const useTemplateRowActions = (
  navigate: ReturnType<typeof useNavigate>,
  refresh: () => void,
  setCopied: Dispatch<SetStateAction<boolean>>
) => {
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

  const handleConvertToPartial = (template: Template) => {
    Promise.resolve(navigate('/partials', { state: { partialDraft: templateToPartial(template) } })).catch(() => {});
  };

  const handleCopyJson = (template: Template) => {
    const json = JSON.stringify(template.descriptor, null, 2);
    navigator.clipboard
      .writeText(json)
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      })
      .catch(() => {});
  };

  return { handleDuplicate, handleDelete, handleConvertToPartial, handleCopyJson };
};

export const Admin = () => {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmConvert, setConfirmConvert] = useState<Template | null>(null);
  const [shareTemplate, setShareTemplate] = useState<Template | null>(null);
  const [copied, setCopied] = useState(false);

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
  const { ref: createRef, hoverProps: createHoverProps } = useIconHover();
  const { ref: emptyCreateRef, hoverProps: emptyCreateHoverProps } = useIconHover();
  const { ref: goToRef, hoverProps: goToHoverProps } = useIconHover();
  const { ref: contributeGithubRef, hoverProps: contributeHoverProps } = useIconHover();

  const { handleDuplicate, handleDelete, handleConvertToPartial, handleCopyJson } = useTemplateRowActions(
    navigate,
    refresh,
    setCopied
  );

  const convertToPartialButton = (template: Template) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setConfirmConvert(template);
      }}
      aria-label={t('card.convertToPartial', { name: template.name })}
      className="min-h-10 min-w-10 text-gray-400 active:scale-[0.98] hover:text-brand-300"
    >
      <Scissors />
    </Button>
  );

  const shareButton = (template: Template) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setCopied(false);
        setShareTemplate(template);
      }}
      aria-label={t('card.share', { name: template.name })}
      className="min-h-10 min-w-10 text-gray-400 active:scale-[0.98] hover:text-brand-300"
    >
      <GithubIcon className="size-4" />
    </Button>
  );

  const actions = (
    <>
      <Button asChild variant="outline" size="sm" className="active:scale-[0.98]">
        <Link to="/studio" {...goToHoverProps}>
          {t('page.goToBuilder')} <ArrowRightIcon ref={goToRef} size={16} />
        </Link>
      </Button>
      <Button asChild className="active:scale-[0.98]" {...createHoverProps}>
        <Link to="/templates/new">
          <PlusIcon ref={createRef} size={16} /> {t('page.create')}
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
          icon={FolderOpenIcon}
          label={t('page.myTemplates')}
          count={mine.length > 0 ? t('page.count', { count: mine.length }) : undefined}
        />
        {mine.length === 0 ? (
          <div className="fade-in mx-auto max-w-md rounded-2xl border border-dashed border-brand-500/30 bg-brand-500/[0.06] p-10 text-center motion-reduce:animate-none">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-500/15 text-brand-300">
              <FolderOpenIcon size={24} />
            </span>
            <p className="mb-1 font-medium text-foreground">{t('page.empty.title')}</p>
            <p className="mb-5 text-sm text-gray-400">{t('page.empty.subtitle')}</p>
            <Button asChild className="mx-auto active:scale-[0.98]" {...emptyCreateHoverProps}>
              <Link to="/templates/new">
                <PlusIcon ref={emptyCreateRef} size={16} /> {t('page.empty.create')}
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
                        <Link
                          to={`/templates/${tpl.id}/edit`}
                          viewTransition
                          onMouseEnter={() => {
                            // Warm the lazy editor chunk so the destination renders synchronously inside the
                            // transition — a Suspense fallback would be the snapshot, leaving no title to morph into.
                            import('@/presentation/pages/TemplateEditorPage').catch(() => {});
                          }}
                          onClick={(event) => {
                            tagTitleForTransition(event.currentTarget);
                          }}
                        >
                          <Pencil /> {t('card.edit')}
                        </Link>
                      </Button>
                      {convertToPartialButton(tpl)}
                      {shareButton(tpl)}
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
        <SectionHeading id="sample-templates" icon={SparklesIcon} label={t('page.samples')} />

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
                    <DuplicateButton
                      label={t('card.duplicate')}
                      onClick={() => {
                        handleDuplicate(tpl);
                      }}
                    />
                  }
                />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="partials-section" className="mt-14 scroll-mt-24">
        <SectionHeading id="partials-section" icon={Braces} label={t('page.partials')} />
        <Link
          to="/partials"
          className="group flex items-center gap-6 rounded-2xl border border-foreground/10 bg-surface/40 px-8 py-6 transition-colors hover:border-brand-500/30 hover:bg-surface/70"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-foreground/10 bg-surface text-foreground/60 transition-colors group-hover:border-brand-500/30 group-hover:text-brand-300">
            <Braces className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-foreground group-hover:text-brand-300">
              {t('page.partials')}
            </p>
            <p className="mt-0.5 text-sm text-gray-400">{t('page.partialsHint')}</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-brand-300" />
        </Link>
      </section>

      {/* Convert-to-partial confirmation */}
      <Dialog
        open={confirmConvert !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmConvert(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('card.convertDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('card.convertDialog.description', { name: confirmConvert?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmConvert(null);
              }}
            >
              {t('card.convertDialog.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (confirmConvert) handleConvertToPartial(confirmConvert);
                setConfirmConvert(null);
              }}
            >
              {t('card.convertDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share on GitHub */}
      <Dialog
        open={shareTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setShareTemplate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GithubIcon className="size-5" />
              {t('card.shareDialog.title')}
            </DialogTitle>
            <DialogDescription>{t('card.shareDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Step 1: Copy JSON */}
            <div className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-300">
                1
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium text-foreground">{t('card.shareDialog.step1')}</p>
                <pre className="max-h-40 overflow-auto rounded-lg border border-foreground/10 bg-background p-3 text-xs leading-relaxed text-foreground/75">
                  {shareTemplate ? JSON.stringify(shareTemplate.descriptor, null, 2) : ''}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => {
                    if (shareTemplate) handleCopyJson(shareTemplate);
                  }}
                >
                  {copied && <Check className="size-4 text-green-400" />}
                  {copied ? t('card.shareDialog.copied') : t('card.shareDialog.copy')}
                </Button>
              </div>
            </div>
            {/* Step 2: Open GitHub */}
            <div className="flex gap-3">
              <span
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-300',
                  copied ? 'bg-brand-500/20 text-brand-300' : 'bg-foreground/[0.08] text-gray-500'
                )}
              >
                2
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium text-foreground">{t('card.shareDialog.step2')}</p>
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    window.open(GITHUB_REPO, '_blank', 'noopener,noreferrer');
                    setShareTemplate(null);
                  }}
                >
                  <GithubIcon className="size-4" />
                  {t('card.shareDialog.openGithub')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section aria-labelledby="contribute-templates" className="mt-14 scroll-mt-24">
        <a
          href="https://github.com/heristop/leclap"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-6 rounded-2xl border border-foreground/10 bg-surface/40 px-8 py-6 transition-colors hover:border-brand-500/30 hover:bg-surface/70"
          {...contributeHoverProps}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-foreground/10 bg-surface text-foreground/60 transition-colors group-hover:border-brand-500/30 group-hover:text-brand-300">
            <GithubIcon ref={contributeGithubRef} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-foreground group-hover:text-brand-300">
              {t('page.contribute.title')}
            </p>
            <p className="mt-0.5 text-sm text-gray-400">{t('page.contribute.description')}</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-brand-300" />
        </a>
      </section>
    </StudioSurface>
  );
};
