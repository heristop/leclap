import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SearchX,
  ArrowRight as ArrowRightIcon,
  Sparkles as SparklesIcon,
  FolderOpen as FolderOpenIcon,
} from '@/presentation/components/icons';
import clsx from 'clsx';
import { templateService, type Template } from '@/services/templateService';
import { logger } from '@/lib/logger';
import { filterTemplates, type ComplexityFacet, type OrientationFacet } from '@/lib/filterTemplates';
import { Badge, Button, Card, Reveal } from '@/presentation/components/ui';
import { PressableScale } from '@/presentation/components/kinetic';
import { TemplateCardContent } from './template-card-content';
import { HighlightMatch } from './HighlightMatch';
import { TemplateSearchBar } from './TemplateSearchBar';
import { EmptyState } from './EmptyState';
import { ClappyReaction } from '@/presentation/components/clappy';

interface TemplateSelectorProps {
  onTemplateSelected: (template: Template) => void;
  selectedTemplate: Template | null;
  onBuildFromScratch?: () => void;
}

interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  onSelect: (template: Template) => void;
  query: string;
}

// Mark this card's title as the View Transition's shared element so it morphs into the editor titlebar
// when the editor opens. Set imperatively at click time so the name is on the DOM before the snapshot.
const tagTitleForTransition = (card: HTMLElement): void => {
  const title = card.querySelector<HTMLElement>('[data-vt-title]');

  if (title) title.style.viewTransitionName = 'studio-title';
};

const TemplateCard = ({ template, isSelected, onSelect, query }: TemplateCardProps) => {
  const { t } = useTranslation('templates');

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      tagTitleForTransition(event.currentTarget);
      onSelect(template);
    }
  };

  return (
    <Card
      interactive
      glow
      role="button"
      tabIndex={0}
      onClick={(event) => {
        tagTitleForTransition(event.currentTarget);
        onSelect(template);
      }}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
      className={clsx(
        'group relative flex h-full w-full flex-col overflow-hidden p-0 text-left',
        isSelected
          ? 'border-brand-500 shadow-lg shadow-brand-500/15 ring-2 ring-brand-500/30'
          : 'border-foreground/10 hover:border-brand-500/40'
      )}
    >
      <TemplateCardContent
        template={template}
        isSelected={isSelected}
        title={<HighlightMatch text={template.name} query={query} />}
        description={<HighlightMatch text={template.description} query={query} />}
        badge={template.source === 'user' ? <Badge variant="brand">{t('custom')}</Badge> : undefined}
        cue={
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 opacity-70 transition-opacity group-hover:opacity-100 dark:text-brand-300">
            {t('useTemplate')}
            <ArrowRightIcon className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        }
      />
    </Card>
  );
};

const LoadingSkeleton = () => (
  <div className="grid gap-6 md:grid-cols-2">
    {[1, 2, 3, 4].map((index) => (
      <div key={index} className="overflow-hidden rounded-2xl border border-foreground/10 bg-surface/50">
        <div className="h-40 shimmer" />
        <div className="space-y-3 p-5">
          <div className="h-5 w-1/2 rounded shimmer" />
          <div className="h-4 w-full rounded shimmer" />
          <div className="h-4 w-2/3 rounded shimmer" />
        </div>
      </div>
    ))}
  </div>
);

const ErrorDisplay = ({ error }: { error: string }) => {
  const { t } = useTranslation('templates');

  return (
    <div className="text-center py-12">
      <div className="inline-block p-6 rounded-2xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10">
        <div className="text-[var(--color-error)] mb-2 font-medium font-display text-lg">{t('error.title')}</div>
        <p className="text-sm text-gray-400 mb-4">{error}</p>
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          {t('actions.retry', { ns: 'common' })}
        </Button>
      </div>
    </div>
  );
};

export const TemplateSelector = ({
  onTemplateSelected,
  selectedTemplate,
  onBuildFromScratch,
}: TemplateSelectorProps) => {
  const { t } = useTranslation('templates');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [orientation, setOrientation] = useState<OrientationFacet>('all');
  const [complexity, setComplexity] = useState<ComplexityFacet>('all');

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        const loadedTemplates = await templateService.getAllTemplates();
        setTemplates(loadedTemplates);
        setError(null);
      } catch (error) {
        logger.error('Failed to load templates:', error);
        setError(t('error.message'));
      } finally {
        setLoading(false);
      }
    };

    loadTemplates().catch(() => {
      setError(t('error.message'));
    });
  }, [t]);

  // The consumer (StudioHome) navigates to the editor with react-router's own `viewTransition`, which
  // drives the title morph. Don't wrap in withViewTransition too — nesting startViewTransition aborts
  // the navigation.
  const handleTemplateSelect = (template: Template) => {
    onTemplateSelected(template);
  };

  const resetFacets = () => {
    setQuery('');
    setOrientation('all');
    setComplexity('all');
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  const shown = filterTemplates(templates, { query, orientation, complexity });
  const myTemplates = shown.filter((tpl) => tpl.source === 'user');
  const sampleTemplates = shown.filter((tpl) => tpl.source === 'sample');

  const renderGrid = (items: Template[], baseDelay = 0) => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((template, index) => (
        <Reveal key={template.id} delay={(baseDelay + index) * 70} className="h-full">
          <TemplateCard
            template={template}
            isSelected={selectedTemplate?.id === template.id}
            onSelect={handleTemplateSelect}
            query={query}
          />
        </Reveal>
      ))}
    </div>
  );

  return (
    <div>
      <TemplateSearchBar
        query={query}
        orientation={orientation}
        complexity={complexity}
        onQuery={setQuery}
        onOrientation={setOrientation}
        onComplexity={setComplexity}
      />

      {onBuildFromScratch && (
        <Reveal delay={0} className="mb-10">
          <PressableScale
            onClick={onBuildFromScratch}
            hoverLift
            className="group relative flex w-full items-center gap-6 overflow-hidden rounded-2xl border border-brand-500/25 bg-linear-to-r from-brand-600/30 via-brand-500/15 to-violet-600/20 px-8 py-6 text-left transition-all hover:border-brand-500/50 hover:from-brand-600/40 hover:via-brand-500/25 hover:to-violet-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-brand-500/15 blur-3xl transition-all group-hover:bg-brand-500/25"
            />
            <span className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl border border-brand-400/30 bg-brand-500/20 text-brand-300 transition-colors group-hover:border-brand-400/50 group-hover:bg-brand-500/30">
              <span className="text-2xl font-light leading-none">+</span>
            </span>
            <div className="relative min-w-0 flex-1">
              <p className="font-display text-xl font-bold text-white">{t('buildFromScratch.label')}</p>
              <p className="mt-0.5 text-sm text-brand-200/70">{t('buildFromScratch.description')}</p>
            </div>
            <span
              aria-hidden="true"
              className="relative shrink-0 text-lg text-brand-300/50 transition-transform group-hover:translate-x-1 group-hover:text-brand-300"
            >
              →
            </span>
          </PressableScale>
        </Reveal>
      )}

      {shown.length === 0 ? (
        // Nothing matched: Clappy looks around the frame and shrugs, as on the 404 — same meaning, same act.
        <EmptyState
          icon={SearchX}
          visual={<ClappyReaction reaction="search" size={112} />}
          title={t('empty.title')}
          hint={t('empty.hint')}
          action={{ label: t('empty.clear'), onClick: resetFacets }}
        />
      ) : (
        <div className="space-y-10">
          {myTemplates.length > 0 && (
            <section aria-labelledby="studio-my-templates">
              <h2
                id="studio-my-templates"
                className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-300/80"
              >
                <FolderOpenIcon size={16} />
                {t('sections.myTemplates')}
                <span className="text-gray-500">({myTemplates.length})</span>
              </h2>
              {renderGrid(myTemplates, 0)}
            </section>
          )}

          {sampleTemplates.length > 0 && (
            <section aria-labelledby="studio-sample-templates">
              <h2
                id="studio-sample-templates"
                className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-300/80"
              >
                <SparklesIcon size={16} />
                {t('sections.sampleTemplates')}
              </h2>
              {renderGrid(sampleTemplates, myTemplates.length)}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
