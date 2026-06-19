import { useState, useEffect, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Zap,
  Video,
  Users,
  Image,
  Square,
  Sparkles,
  Layers,
  SearchX,
  type LucideIcon,
} from '@/presentation/components/icons';
import clsx from 'clsx';
import { templateService, type Template } from '@/services/templateService';
import { logger } from '@/lib/logger';
import { filterTemplates, type ComplexityFacet, type OrientationFacet } from '@/lib/filterTemplates';
import { Badge, Button, Card, Reveal } from '@/presentation/components/ui';
import { TemplatePoster } from './TemplatePoster';
import { TemplateSearchBar } from './TemplateSearchBar';
import { EmptyState } from './EmptyState';

interface TemplateSelectorProps {
  onTemplateSelected: (template: Template) => void;
  selectedTemplate: Template | null;
}

interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  onSelect: (template: Template) => void;
}

const MetaChip = ({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.05] px-2.5 py-1 text-xs font-medium text-gray-400">
    <Icon className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
    {children}
  </span>
);

// Orientation → meta-chip icon (portrait a tall image, square a 1:1 box, landscape a wide frame).
const ORIENTATION_ICON: Record<Template['orientation'], LucideIcon> = {
  portrait: Image,
  square: Square,
  landscape: Video,
};

const CardMetaChips = ({
  template,
  fieldCount,
  sectionCount,
}: {
  template: Template;
  fieldCount: number;
  sectionCount: number;
}) => {
  const { t } = useTranslation('templates');
  const orientation = template.orientation;

  return (
    <div className="flex flex-wrap gap-2">
      <MetaChip icon={ORIENTATION_ICON[orientation]}>{t(`orientation.${orientation}`)}</MetaChip>
      <MetaChip icon={template.hasForm ? Users : Zap}>
        {template.hasForm ? t('fields', { count: fieldCount }) : t('autoProcess')}
      </MetaChip>
      <MetaChip icon={Layers}>{t('sections', { count: sectionCount })}</MetaChip>
      {template.descriptor.global?.musicEnabled && (
        <Badge variant="secondary" className="normal-case tracking-normal">
          <Sparkles className="w-3.5 h-3.5" /> {t('music')}
        </Badge>
      )}
    </div>
  );
};

// Mark this card's title as the View Transition's shared element so it morphs into the studio titlebar
// when the editor opens. Set imperatively at click time so the name is on the DOM before the snapshot.
const tagTitleForTransition = (card: HTMLElement): void => {
  const title = card.querySelector<HTMLElement>('[data-vt-title]');

  if (title) title.style.viewTransitionName = 'studio-title';
};

const TemplateCard = ({ template, isSelected, onSelect }: TemplateCardProps) => {
  const { t } = useTranslation('templates');
  const fieldCount = templateService.extractFormFields(template.descriptor).length;
  const sectionCount = template.descriptor.sections?.length ?? 0;

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
      role="button"
      tabIndex={0}
      onClick={(e) => {
        tagTitleForTransition(e.currentTarget);
        onSelect(template);
      }}
      onKeyDown={handleKeyDown}
      onMouseMove={(e) => {
        // Track the pointer for the spotlight glow (cheap: sets CSS vars, no React re-render).
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
      }}
      aria-pressed={isSelected}
      className={clsx(
        'lift spotlight group relative h-full w-full overflow-hidden p-0 text-left',
        isSelected
          ? 'border-brand-500 shadow-lg shadow-brand-500/15 ring-2 ring-brand-500/30'
          : 'border-foreground/10 hover:border-brand-500/40'
      )}
    >
      <TemplatePoster template={template} isSelected={isSelected} />

      <div className="p-5">
        {template.source === 'user' && (
          <div className="mb-2">
            <Badge variant="brand">{t('custom')}</Badge>
          </div>
        )}
        <h3
          data-vt-title
          className="mb-1.5 font-display text-xl font-bold text-foreground transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-300"
        >
          {template.name}
        </h3>
        <p className="mb-4 text-sm leading-relaxed text-gray-400">{template.description}</p>
        <CardMetaChips template={template} fieldCount={fieldCount} sectionCount={sectionCount} />
      </div>
    </Card>
  );
};

const LoadingSkeleton = () => (
  <div className="grid gap-6 md:grid-cols-2">
    {[1, 2, 3, 4].map((index) => (
      <div key={index} className="overflow-hidden rounded-2xl border border-foreground/10 bg-surface/50">
        <div className="h-24 shimmer" />
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

export const TemplateSelector = ({ onTemplateSelected, selectedTemplate }: TemplateSelectorProps) => {
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

      {shown.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t('empty.title')}
          hint={t('empty.hint')}
          action={{ label: t('empty.clear'), onClick: resetFacets }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((template, index) => (
            <Reveal key={template.id} delay={index * 70} className="h-full">
              <TemplateCard
                template={template}
                isSelected={selectedTemplate?.id === template.id}
                onSelect={handleTemplateSelect}
              />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
};
