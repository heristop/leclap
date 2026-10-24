import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Music as MusicIcon } from '@/presentation/components/icons';
import { templateService, type Template } from '@/services/templateService';
import { TemplatePoster } from './TemplatePoster';
import { ComplexityMeter } from './complexity-meter';

// The card's one meta line: format, what the user fills in, and music when it has some (the section count
// labels the poster's strip).
const TemplateMeta = ({ template }: { template: Template }) => {
  const { t } = useTranslation('templates');
  const fieldCount = templateService.extractFormFields(template.descriptor).length;
  const parts = [
    t(`orientation.${template.orientation}`),
    template.hasForm ? t('fields', { count: fieldCount }) : t('autoProcess'),
  ];

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {parts.map((part, index) => (
        <span key={part} className="inline-flex items-center gap-2">
          {index > 0 && (
            <span aria-hidden className="text-foreground/25">
              ·
            </span>
          )}
          {part}
        </span>
      ))}
      {template.descriptor.global?.musicEnabled && (
        <span className="inline-flex items-center gap-1 font-medium text-secondary-600 dark:text-secondary-300">
          <span aria-hidden className="text-foreground/25">
            ·
          </span>
          <MusicIcon className="size-3.5" />
          {t('music')}
        </span>
      )}
    </p>
  );
};

interface TemplateCardContentProps {
  template: Template;
  /** The name, usually with its search highlight; set on the poster like a film's title card. */
  title: ReactNode;
  description: ReactNode;
  isSelected?: boolean;
  /** A small tag above the description (the studio marks the user's own templates). */
  badge?: ReactNode;
  /** Right of the complexity meter: the studio's "Use template" cue. */
  cue?: ReactNode;
  /** A row of buttons under the footer line: the library's edit, duplicate and share actions. */
  actions?: ReactNode;
}

// What every template card shows, in /studio and in the library (/templates): the poster with the name as
// its title card, the description, one meta line, then a footer with the complexity meter and the card's
// own way forward. The two pages only differ in the wrapper (a pickable card or a static one) and the footer.
export const TemplateCardContent = ({
  template,
  title,
  description,
  isSelected = false,
  badge,
  cue,
  actions,
}: TemplateCardContentProps) => {
  const { t } = useTranslation('templates');

  return (
    <>
      <TemplatePoster template={template} isSelected={isSelected}>
        <h3
          data-vt-title
          className="line-clamp-1 font-display text-2xl font-bold text-white drop-shadow-[0_2px_8px_oklch(0_0_0/0.5)]"
        >
          {title}
        </h3>
      </TemplatePoster>

      <div className="flex flex-1 flex-col p-5">
        {badge && <div className="mb-2">{badge}</div>}
        <p className="mb-3 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">{description}</p>
        <TemplateMeta template={template} />

        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between gap-3 border-t border-foreground/10 pt-4">
            <ComplexityMeter complexity={template.complexity} label={t(`complexity.${template.complexity}`)} />
            {cue}
          </div>
          {actions && <div className="mt-4 flex gap-2">{actions}</div>}
        </div>
      </div>
    </>
  );
};
