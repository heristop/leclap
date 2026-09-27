// The template library's building blocks (/templates): the poster card, the section heading, the
// empty shelf, the loading and error states, and the link cards at the foot of the page. Presentational
// only — the page owns the data and the dialogs.
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AlertCircle, ArrowRight } from '@/presentation/components/icons';
import { CopyIcon } from '@/presentation/components/icons/copy';
import { PlusIcon } from '@/presentation/components/icons/plus';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { Button, Card } from '@/presentation/components/ui';
import { Clappy } from '@/presentation/components/clappy';
import { TemplatePoster } from '@/presentation/components/TemplatePoster';
import type { Template } from '@/services/templateService';
import { cn } from '@/lib/utils';

export const LIBRARY_GRID = 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3';

interface TemplateCardProps {
  template: Template;
  actions: ReactNode;
  t: TFunction<'admin'>;
}

// The poster-card language, shared with /studio: a seeded gradient band fronts a surface-2 card that
// lifts and spotlights on hover with a brand ring. The complexity tag lives on the poster, so the
// body carries the name, description and a compact meta line.
export const TemplateCard = ({ template, actions, t }: TemplateCardProps) => (
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
      <p className="mb-4 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
        {template.description || t('card.noDescription')}
      </p>
      <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
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
      </p>
      <div className="mt-auto flex gap-2">{actions}</div>
    </div>
  </Card>
);

export const LibrarySectionHeading = ({
  id,
  icon: Icon,
  label,
  count,
}: {
  id: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  count?: string;
}) => (
  // Programmatically focusable (never a tab stop) so focus can land here after a card is deleted.
  <h2
    id={id}
    tabIndex={-1}
    className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-300/80 outline-none"
  >
    <Icon className="size-4" /> {label}
    {count && <span className="text-muted-foreground">{count}</span>}
  </h2>
);

// An icon-only card action. The glyph alone is ambiguous (scissors for "convert to partial"), so the
// accessible name doubles as the hover tooltip.
export const CardIconAction = ({
  label,
  onClick,
  destructive = false,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: ReactNode;
}) => (
  <Button
    variant="ghost"
    size="sm"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={cn(
      'min-h-10 min-w-10 text-muted-foreground active:scale-[0.98]',
      destructive ? 'hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]' : 'hover:text-brand-300'
    )}
  >
    {children}
  </Button>
);

// "Duplicate & edit" action whose copy icon animates on hover of the whole button (group hover), driven
// from the button via the icon's imperative handle (the Button suppresses the glyph's own pointer events).
export const DuplicateButton = ({ label, onClick }: { label: string; onClick: () => void }) => {
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

// The empty shelf: Clappy waves beside the one thing to do. The header already carries the primary
// "Create template", so this action steps down to outline rather than stacking a second gradient
// button in the same view — the samples right below are the other way in.
export const EmptyLibrary = () => {
  const { t } = useTranslation('admin');
  const { ref, hoverProps } = useIconHover();

  return (
    <div className="fade-in flex max-w-2xl flex-col items-start gap-4 rounded-2xl border border-dashed border-brand-500/30 bg-brand-500/[0.06] p-6 motion-reduce:animate-none sm:flex-row sm:items-center sm:gap-7 sm:p-7">
      {/* Decorative: the copy beside him says what to do. */}
      <Clappy size={88} mood="smile" armR={150} lookX={0.7} lookY={0.25} className="shrink-0" />
      <div className="min-w-0">
        <p className="font-display text-xl font-bold text-foreground">{t('page.empty.title')}</p>
        <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{t('page.empty.subtitle')}</p>
        <Button asChild variant="outline" size="sm" className="mt-4 min-h-10 active:scale-[0.98]" {...hoverProps}>
          <Link to="/templates/new">
            <PlusIcon ref={ref} size={16} /> {t('page.empty.create')}
          </Link>
        </Button>
      </div>
    </div>
  );
};

// Card-shaped placeholders (poster band + title, two lines, meta, action) at the real card's rhythm, so
// the grid doesn't jump when the samples land. Opacity pulse only; still under reduced motion.
export const LibrarySkeleton = () => (
  <div aria-hidden className={LIBRARY_GRID}>
    {[0, 1, 2].map((slot) => (
      <div
        key={slot}
        className="animate-pulse overflow-hidden rounded-2xl border border-foreground/10 bg-surface-2/50 motion-reduce:animate-none"
      >
        <div className="h-24 bg-foreground/[0.07]" />
        <div className="p-5">
          <div className="mb-3 h-5 w-2/5 rounded-md bg-foreground/10" />
          <div className="mb-2 h-3.5 rounded bg-foreground/[0.07]" />
          <div className="mb-5 h-3.5 w-4/5 rounded bg-foreground/[0.07]" />
          <div className="mb-5 h-3 w-1/3 rounded bg-foreground/[0.06]" />
          <div className="h-10 rounded-xl bg-foreground/[0.06]" />
        </div>
      </div>
    ))}
  </div>
);

export const LibraryError = ({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) => (
  <div
    role="alert"
    className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-5 py-4"
  >
    <AlertCircle aria-hidden className="size-5 shrink-0 text-[var(--color-error)]" />
    <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{message}</p>
    <Button variant="outline" size="sm" className="min-h-10" onClick={onRetry}>
      {retryLabel}
    </Button>
  </div>
);

type LinkCardTarget = { to: string; href?: never } | { href: string; to?: never };

// A quiet row linking out of the library (partials editor, GitHub). The arrow nudges on hover; an
// animated icon can ride the whole card's hover through `hoverProps`.
export const LibraryLinkCard = ({
  icon,
  title,
  description,
  hoverProps,
  ...linkProps
}: {
  icon: ReactNode;
  title: string;
  description: string;
  hoverProps?: ReturnType<typeof useIconHover>['hoverProps'];
} & LinkCardTarget) => {
  const className =
    'group flex h-full items-center gap-5 rounded-2xl border border-foreground/10 bg-surface/40 px-6 py-5 transition-colors hover:border-brand-500/30 hover:bg-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50';
  const body = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-foreground/10 bg-surface text-foreground/60 transition-colors group-hover:border-brand-500/30 group-hover:text-brand-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold text-foreground group-hover:text-brand-300">{title}</span>
        <span className="mt-0.5 block text-pretty text-sm text-muted-foreground">{description}</span>
      </span>
      <ArrowRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand-300 motion-reduce:transition-none"
      />
    </>
  );

  if (linkProps.to !== undefined) {
    return (
      <Link to={linkProps.to} className={className} {...hoverProps}>
        {body}
      </Link>
    );
  }

  return (
    <a href={linkProps.href} target="_blank" rel="noopener noreferrer" className={className} {...hoverProps}>
      {body}
    </a>
  );
};
