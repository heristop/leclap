import { motion } from 'motion/react';
import { useState } from 'react';
import { ArrowUpRightIcon } from '@/presentation/components/icons/arrow-up-right';
import { useTranslation } from 'react-i18next';
import { useInView } from '@/hooks/useInView';

// A sincere acknowledgment to the FFmpeg project — the engine every clip, filter and
// transition runs on. Kept deliberately editorial (not a tech badge): an oversized, offset
// heart watermark carries the gratitude, the copy is left-aligned and reads like a note.
export const AboutThanks = () => {
  const { t } = useTranslation('about');
  // Reduced-motion viewers see the heart fully drawn at once (the stroke draw is JS-driven, so the
  // global CSS reset can't neutralise it — guard it explicitly).
  const [reduced] = useState(() => globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // One-shot: the outline "draws" itself the first time the section scrolls into view.
  const [heartRef, heartInView] = useInView<SVGSVGElement>();
  const drawn = reduced || heartInView;

  return (
    <section className="mt-16 relative overflow-hidden rounded-2xl glass-panel-dark p-8 md:p-12">
      {/* Self-drawing heart watermark: stroke draws from 0→100% via stroke-dashoffset. pathLength=1
          normalises the path so the dash maths is unit-based (no real length measurement needed). */}
      <motion.svg
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
        className="lucide pointer-events-none absolute -right-8 -bottom-10 rotate-12 text-secondary-500/10"
      >
        <motion.path
          d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
          pathLength={1}
          strokeDasharray={1}
          initial={{ strokeDashoffset: reduced ? 0 : 1 }}
          animate={{ strokeDashoffset: drawn ? 0 : 1 }}
          transition={reduced ? { duration: 0 } : { duration: 1.8, ease: 'easeInOut' }}
        />
      </motion.svg>

      <div className="relative max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary-600 dark:text-secondary-300">
          {t('thanks.kicker')}
        </p>

        <p className="mt-4 font-display text-2xl md:text-3xl font-semibold leading-snug text-foreground text-balance">
          {t('thanks.lead')}
        </p>

        <p className="mt-4 text-gray-300 leading-relaxed">{t('thanks.body')}</p>

        <a
          href="https://ffmpeg.org"
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-300 cursor-pointer"
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
