import { motion } from 'motion/react';
import { ArrowUpRight as ArrowUpRightIcon } from '@/presentation/components/icons';
import { useTranslation } from 'react-i18next';
import { GLYPHS } from '@leclap/creative-kit/icons';
import { useInView } from '@/hooks/useInView';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

// The set's own heart (@leclap/creative-kit/icons), drawn large so its outline can draw itself.
const [[, { d: HEART }]] = GLYPHS.heart.parts;

// A sincere acknowledgment to the FFmpeg project — the engine every clip, filter and
// transition runs on. Kept deliberately editorial (not a tech badge): an oversized, offset
// heart watermark carries the gratitude, the copy is left-aligned and reads like a note.
export const AboutThanks = () => {
  const { t } = useTranslation('about');
  // Reduced-motion viewers see the heart fully drawn at once (the stroke draw is JS-driven, so the
  // global CSS reset can't neutralise it — guard it explicitly).
  const prefersReducedMotion = useReducedMotion();
  const reduced = typeof window === 'undefined' || prefersReducedMotion;
  // One-shot: the outline "draws" itself the first time the section scrolls into view.
  const [heartRef, heartInView] = useInView<SVGSVGElement>();
  const drawn = reduced || heartInView;

  return (
    <section className="mt-16 relative overflow-hidden rounded-2xl glass-panel-dark p-8 md:p-12">
      {/* Self-drawing heart watermark: stroke draws from 0→100% via stroke-dashoffset. pathLength=1
          normalises the path so the dash maths is unit-based (no real length measurement needed).
          The wrapper is a plain <svg>: it carries no motion props, and motion's SVG components
          currently type their ref as Ref<never>, so they can't take a typed element ref. */}
      <svg
        ref={heartRef}
        aria-hidden="true"
        width={208}
        height={208}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        className="pointer-events-none absolute -right-8 -bottom-10 rotate-12 text-secondary-500/10"
      >
        <motion.path
          d={HEART}
          pathLength={1}
          strokeDasharray={1}
          initial={{ strokeDashoffset: reduced ? 0 : 1 }}
          animate={{ strokeDashoffset: drawn ? 0 : 1 }}
          transition={reduced ? { duration: 0 } : { duration: 1.8, ease: 'easeInOut' }}
        />
      </svg>

      <div className="relative max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary-700 dark:text-secondary-300">
          {t('thanks.kicker')}
        </p>

        {/* The section's heading: the sentence the rest of it explains. */}
        <h2 className="mt-4 font-display text-2xl md:text-3xl font-semibold leading-snug text-foreground text-balance">
          {t('thanks.lead')}
        </h2>

        <p className="mt-4 text-gray-300 leading-relaxed">{t('thanks.body')}</p>

        <a
          href="https://ffmpeg.org"
          target="_blank"
          rel="noopener noreferrer"
          // `min-h-11` gives the link a row a thumb can hit; `-mx-2 px-2` keeps the text on the column's edge.
          className="group mt-4 -mx-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-brand-700 dark:text-brand-300 cursor-pointer"
        >
          {t('thanks.link')}
          <ArrowUpRightIcon
            size={16}
            className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </a>
      </div>
    </section>
  );
};
