import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useScroll, useTransform } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { FilmstripEdge } from '@/presentation/components/kinetic';
import { Reveal } from '@/presentation/components/ui';
import { STORY_CHAPTERS, storyMonth } from './about-story.logic';

// The about page's story: three dated beats on a timeline, told the way the product is built — the
// editor's filmstrip rail is the spine, and a playhead fills it as the story scrolls past, so reading
// down the page reads like scrubbing through the project's history. From `lg` the section's heading
// stays pinned beside the beats, the landing's deep-dive idiom at a smaller scale. Under reduced motion
// the playhead is simply drawn in full: the rail and its cue points still say "timeline" without moving.
export const AboutStory = () => {
  const { t, i18n } = useTranslation('about');
  const lang = i18n.resolvedLanguage ?? 'en';
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLOListElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  // The same line of the screen at both ends, so while the beats scroll past, the head holds still on
  // that line — an editor's playhead standing while the timeline moves under it — and each date reaches
  // it just below the middle, about when it is read.
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start 55%', 'end 55%'] });
  // The head rides the fill's leading edge from the first cue point down. It moves by transform, so it
  // needs the rail's length in px.
  const railHeight = useMotionValue(0);
  const headY = useTransform([scrollYProgress, railHeight], ([progress, height]: number[]) => progress * height);

  useEffect(() => {
    const rail = railRef.current;

    if (!rail) return () => {};

    const observer = new ResizeObserver(([entry]) => {
      railHeight.set(entry.contentRect.height);
    });
    observer.observe(rail);

    return () => {
      observer.disconnect();
    };
  }, [railHeight]);

  return (
    <section
      aria-labelledby="about-story"
      className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20"
    >
      <div className="lg:sticky lg:top-28 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-700 dark:text-brand-300">
          {t('story.eyebrow')}
        </p>
        {/* Sentence case, like the page's h1, rather than the landing's capitals: Oswald's accented
            capitals (À, É, Ü) rise to 1.08em against a 0.81em cap height, so at display leading a French
            or German line's accents run into the line above. Lowercase accents stop at 0.84em, which a
            1.08 leading clears even under a descender. */}
        <h2
          id="about-story"
          className="mt-4 font-display text-[length:var(--text-display-l)] leading-[1.08] font-bold tracking-[-0.01em] text-balance"
        >
          {t('story.title')}
        </h2>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-pretty text-gray-400">{t('story.lead')}</p>
      </div>

      <div ref={railRef} className="relative">
        <FilmstripEdge className="absolute inset-y-0 left-0" />
        {/* The playhead: brand gradient along the rail's centre line, grown from the top by the scroll,
            with a lit head on its leading edge so it reads as a scrubber rather than a coloured rule. */}
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 left-[6px] w-0.5 origin-top rounded-full bg-linear-to-b from-brand-500 to-secondary-400"
          style={{ scaleY: reduced ? 1 : scrollYProgress }}
        />
        {!reduced && (
          <motion.span
            aria-hidden="true"
            className="absolute top-2.5 left-[7px] -mt-1.5 -ml-1.5 size-3 rounded-full bg-secondary-400 shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-secondary-400)_28%,transparent),0_0_14px_2px_color-mix(in_oklch,var(--color-secondary-400)_45%,transparent)]"
            style={{ y: headY }}
          />
        )}
        <ol ref={trackRef} role="list" className="relative pl-10 sm:pl-12">
          {STORY_CHAPTERS.map(({ id, version, date }) => (
            <li key={id} className="relative pb-14 last:pb-0 sm:pb-20">
              {/* The beat's cue point, centred on the rail and punched out of it by the page colour. */}
              <span
                aria-hidden="true"
                className="absolute top-1.5 left-[calc(-2.5rem+3px)] size-2 rounded-full bg-brand-500 ring-4 ring-background sm:left-[calc(-3rem+3px)]"
              />
              <Reveal>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-sm font-bold tracking-[0.2em] text-brand-700 uppercase dark:text-brand-300">
                  {date ? <time dateTime={date}>{storyMonth(date, lang)}</time> : <span>{t('story.today')}</span>}
                  {version && (
                    <span className="rounded-full border border-divider px-2 py-0.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground normal-case">
                      {version}
                    </span>
                  )}
                </p>
                <h3 className="mt-3 font-display text-3xl leading-[1.1] font-bold tracking-[-0.01em] text-balance sm:text-4xl">
                  {t(`story.chapters.${id}.title`)}
                </h3>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-pretty text-gray-400">
                  {t(`story.chapters.${id}.body`)}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
