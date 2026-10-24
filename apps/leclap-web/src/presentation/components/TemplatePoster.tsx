import type { CSSProperties, ReactNode } from 'react';
import { Check } from '@/presentation/components/icons';
import { templatePoster } from '@/lib/poster';
import { SECTION_ICON } from '@/lib/sectionMeta';
import type { Template } from '@/services/templateService';

interface TemplatePosterProps {
  template: Template;
  isSelected?: boolean;
  /** The card's title, set large at the foot of the strip like a film's title card. */
  children?: ReactNode;
}

// Every scene frame is the same size, whatever the template's format (the meta line names that).
const FRAME_WIDTH = 52;
const FRAME_HEIGHT = 44;

// Sprocket holes, the same ticks as the player's timeline.
const SPROCKETS: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(90deg, oklch(1 0 0 / 0.16) 0 0.5rem, transparent 0.5rem 1rem)',
};

/** One scene's frame: its slice of the template's gradient. */
const frameStyle = (gradient: string, index: number, count: number): CSSProperties => ({
  width: FRAME_WIDTH,
  height: FRAME_HEIGHT,
  backgroundImage: gradient,
  backgroundSize: `${count * 100}% 100%`,
  backgroundPosition: `${count > 1 ? (index / (count - 1)) * 100 : 0}% 50%`,
});

// The poster that fronts every template card across /studio and /templates: a film's title card. Along the
// top runs the template as a strip of film, one frame per scene cut from its seeded gradient, numbered and
// marked with its kind (a +N frame stands for the scenes past six); the strip runs off the card's right edge
// and advances a little when the card is hovered. The card's title sits large at the foot, over a scrim,
// between the strip and a row of sprocket holes. Selection shows a check pip. Presentational only.
export const TemplatePoster = ({ template, isSelected = false, children }: TemplatePosterProps) => {
  const poster = templatePoster(template.id, template.descriptor);
  const count = poster.glyphs.length;

  return (
    <div className="relative h-40 overflow-hidden bg-[var(--color-player-ink)]">
      <div aria-hidden className="absolute -inset-8 opacity-40 blur-2xl" style={{ backgroundImage: poster.gradient }} />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-[var(--color-player-ink)] via-[var(--color-player-ink)]/70 to-transparent"
      />
      <div aria-hidden className="absolute inset-x-0 top-2.5 h-1.5" style={SPROCKETS} />
      <div aria-hidden className="absolute inset-x-0 bottom-2.5 h-1.5" style={SPROCKETS} />

      <div
        aria-hidden
        className="absolute inset-x-0 top-6 flex items-center gap-1.5 pl-5 transition-transform duration-500 ease-[var(--ease-out-expo)] [mask-image:linear-gradient(to_right,black_78%,transparent)] motion-safe:group-hover:-translate-x-3"
      >
        {poster.glyphs.map((kind, index) => {
          const Glyph = SECTION_ICON[kind];

          return (
            <span
              key={index}
              className="relative grid shrink-0 place-items-center overflow-hidden rounded-md text-white shadow-[0_4px_14px_-6px_oklch(0_0_0/0.6)] ring-1 ring-white/15 [&_.lc-f]:fill-white/30"
              style={frameStyle(poster.gradient, index, count)}
            >
              <span className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,oklch(1_0_0/0.28),transparent_60%)]" />
              <span className="absolute left-1 top-0.5 font-mono text-[8px] leading-none text-white/75 tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <Glyph className="relative size-4" strokeWidth={2.2} />
            </span>
          );
        })}
        {poster.more > 0 && (
          <span
            className="grid shrink-0 place-items-center rounded-md border border-dashed border-white/25 font-mono text-xs text-white/70"
            style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}
          >
            +{poster.more}
          </span>
        )}
      </div>

      {children && <div className="absolute inset-x-5 bottom-6">{children}</div>}

      {isSelected && (
        <span className="pop-in absolute right-4 top-4 grid size-7 place-items-center rounded-full bg-white text-brand-600 shadow-md">
          <Check className="size-4" strokeWidth={2.6} />
        </span>
      )}
    </div>
  );
};
