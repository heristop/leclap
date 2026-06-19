import { useTranslation } from 'react-i18next';
import { Check } from '@/presentation/components/icons';
import { templatePoster } from '@/lib/poster';
import { SECTION_ICON } from '@/lib/sectionMeta';
import type { Template } from '@/services/templateService';

interface TemplatePosterProps {
  template: Template;
  isSelected?: boolean;
}

// The shared poster band that fronts every template card across /studio and /templates: a seeded
// gradient (top-left light wash + bottom scrim for depth) with the complexity tag and section glyphs
// in frosted chips that stay legible on any hue. Selection shows a check pip. Presentational only.
export const TemplatePoster = ({ template, isSelected = false }: TemplatePosterProps) => {
  const { t } = useTranslation('templates');
  const poster = templatePoster(template.id, template.descriptor);

  return (
    <div className="relative h-24 overflow-hidden" style={{ backgroundImage: poster.gradient }}>
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(115%_115%_at_0%_0%,rgba(255,255,255,0.32),transparent_55%)]"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/25 to-transparent" />

      <span className="absolute left-3 top-3 rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm">
        {t(`complexity.${template.complexity}`)}
      </span>

      <div className="absolute inset-x-3 bottom-3 flex items-center gap-1.5">
        {poster.glyphs.map((kind, index) => {
          const Glyph = SECTION_ICON[kind];

          return (
            <span
              key={index}
              className="grid h-7 w-7 place-items-center rounded-lg bg-white/20 text-white ring-1 ring-white/25 backdrop-blur-sm"
            >
              <Glyph className="h-4 w-4" />
            </span>
          );
        })}
      </div>

      {isSelected && (
        <span className="pop-in absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white text-brand-600 shadow-md">
          <Check className="h-4 w-4" />
        </span>
      )}
    </div>
  );
};
