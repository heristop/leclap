import { useState, useEffect, startTransition, type ComponentType, type ReactNode } from 'react';
import { Check, Play, Zap, Video, Users, Image, Sparkles, Layers } from 'lucide-react';
import clsx from 'clsx';
import { templateService, type Template } from '@/services/templateService';
import { logger } from '@/lib/logger';
import { Badge, Button, Card, Reveal, type BadgeProps } from '@/presentation/components/ui';

interface TemplateSelectorProps {
  onTemplateSelected: (template: Template) => void;
  selectedTemplate: Template | null;
}

interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  onSelect: (template: Template) => void;
}

const getTemplateIcon = (template: Template): ComponentType<{ className?: string }> => {
  if (template.hasForm) return Users;

  if (template.orientation === 'portrait') return Image;

  if (template.complexity === 'advanced') return Zap;

  return Play;
};

const complexityBadgeVariant: Record<string, BadgeProps['variant']> = {
  simple: 'brand',
  intermediate: 'secondary',
  advanced: 'accent',
};

const MetaChip = ({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-foreground/[0.04] text-gray-400 border border-foreground/10">
    <Icon className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
    {children}
  </span>
);

const CardIcon = ({ isSelected, Icon }: { isSelected: boolean; Icon: ComponentType<{ className?: string }> }) => (
  <div className="relative shrink-0">
    <span
      className={clsx(
        'grid place-items-center w-14 h-14 rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
        isSelected
          ? 'brand-gradient text-white shadow-lg shadow-brand-500/30'
          : 'bg-brand-500/10 text-brand-600 dark:text-brand-300 group-hover:bg-brand-500/20 group-hover:scale-105 group-hover:-rotate-6'
      )}
    >
      <Icon className="w-7 h-7" />
    </span>
    {isSelected && (
      <span className="absolute -top-1.5 -right-1.5 grid place-items-center w-6 h-6 rounded-full bg-brand-600 text-white shadow-md ring-2 ring-surface pop-in">
        <Check className="w-3.5 h-3.5" />
      </span>
    )}
  </div>
);

const cardClass = (isSelected: boolean) =>
  clsx(
    'group relative w-full h-full text-left p-6',
    isSelected
      ? 'border-brand-500 bg-brand-500/[0.06] dark:bg-brand-500/10 shadow-lg shadow-brand-500/15'
      : 'bg-surface/40 hover:border-brand-500/40 hover:bg-surface/70'
  );

const CardMetaChips = ({ template, fieldCount, sectionCount }: { template: Template; fieldCount: number; sectionCount: number }) => (
  <div className="flex flex-wrap gap-2">
    <MetaChip icon={template.orientation === 'portrait' ? Image : Video}>
      {template.orientation === 'portrait' ? 'Portrait 9:16' : 'Landscape 16:9'}
    </MetaChip>
    <MetaChip icon={template.hasForm ? Users : Zap}>
      {template.hasForm ? `${fieldCount} field${fieldCount === 1 ? '' : 's'}` : 'Auto-process'}
    </MetaChip>
    <MetaChip icon={Layers}>
      {sectionCount} section{sectionCount === 1 ? '' : 's'}
    </MetaChip>
    {template.descriptor.global?.musicEnabled && (
      <Badge variant="secondary" className="normal-case tracking-normal">
        <Sparkles className="w-3.5 h-3.5" /> Music
      </Badge>
    )}
  </div>
);

const TemplateCard = ({ template, isSelected, onSelect }: TemplateCardProps) => {
  const IconComponent = getTemplateIcon(template);
  const fieldCount = templateService.extractFormFields(template.descriptor).length;
  const sectionCount = template.descriptor.sections?.length ?? 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(template);
    }
  };

  return (
    <Card
      interactive
      role="button"
      tabIndex={0}
      onClick={() => {
        onSelect(template);
      }}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
      className={cardClass(isSelected)}
    >
      {/* Header: branded icon + complexity */}
      <div className="flex items-start justify-between mb-5">
        <CardIcon isSelected={isSelected} Icon={IconComponent} />

        <div className="flex flex-col items-end gap-2">
          {template.source === 'user' && <Badge variant="brand">Custom</Badge>}
          <Badge variant={complexityBadgeVariant[template.complexity] ?? 'neutral'}>{template.complexity}</Badge>
        </div>
      </div>

      {/* Title + description */}
      <h3 className="text-xl font-bold font-display text-foreground mb-1.5 group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
        {template.name}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-5">{template.description}</p>

      {/* Meta chips — flat, branded, no nested boxes */}
      <CardMetaChips template={template} fieldCount={fieldCount} sectionCount={sectionCount} />
    </Card>
  );
};

const LoadingSkeleton = () => (
  <div className="grid gap-6 md:grid-cols-2">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="h-56 rounded-2xl border border-foreground/5 bg-surface/50 shimmer" />
    ))}
  </div>
);

const ErrorDisplay = ({ error }: { error: string }) => (
  <div className="text-center py-12">
    <div className="inline-block p-6 rounded-2xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10">
      <div className="text-[var(--color-error)] mb-2 font-medium font-display text-lg">Failed to load templates</div>
      <p className="text-sm text-gray-400 mb-4">{error}</p>
      <Button
        onClick={() => {
          window.location.reload();
        }}
      >
        Retry
      </Button>
    </div>
  </div>
);

export const TemplateSelector = ({ onTemplateSelected, selectedTemplate }: TemplateSelectorProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        const loadedTemplates = await templateService.getAllTemplates();
        setTemplates(loadedTemplates);
        setError(null);
      } catch (error) {
        logger.error('Failed to load templates:', error);
        setError('Failed to load templates. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates().catch(() => {
      setError('Failed to load templates. Please try again.');
    });
  }, []);

  const handleTemplateSelect = (template: Template) => {
    startTransition(() => {
      onTemplateSelected(template);
    });
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {templates.map((template, index) => (
        <Reveal key={template.id} delay={index * 70} className="h-full">
          <TemplateCard
            template={template}
            isSelected={selectedTemplate?.id === template.id}
            onSelect={handleTemplateSelect}
          />
        </Reveal>
      ))}
    </div>
  );
};
