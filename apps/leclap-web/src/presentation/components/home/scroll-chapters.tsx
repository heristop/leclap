import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The deep-dive sections tell their story in chapters that scroll past a pinned visual (desktop), the way a
// product page keeps a device on screen while its display changes. On narrow screens nothing is pinned:
// each chapter carries its own media inline, so the page simply scrolls.

/** The breakpoint where the pinned visual takes over from the inline media (Tailwind's `lg`). */
export const PINNED_QUERY = '(min-width: 64rem)';

export interface Chapter {
  key: string;
  title: string;
  body: string;
}

/**
 * Which chapter sits in the reading band — the middle fifth of the viewport. Each chapter reports itself via
 * IntersectionObserver; the one crossing the band becomes active. Landing between two chapters without
 * scrolling there — a reload's restored position, a hash link — crosses no band, so the observer's first
 * report and any jump of more than a screen pick the chapter nearest the middle instead.
 */
export const useActiveChapter = (
  count: number
): { active: number; register: (index: number) => (node: HTMLElement | null) => void } => {
  const nodes = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return () => {};

    const chapters = nodes.current.slice(0, count);

    const activate = (node: Element) => {
      const index = chapters.indexOf(node as HTMLElement);

      if (index >= 0) setActive(index);
    };

    const activateNearest = () => {
      const middle = globalThis.innerHeight / 2;
      let nearest: HTMLElement | null = null;
      let best = Number.POSITIVE_INFINITY;

      for (const node of chapters) {
        if (!node) continue;

        const rect = node.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - middle);

        if (distance >= best) continue;

        best = distance;
        nearest = node;
      }

      if (nearest) activate(nearest);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries.find((entry) => entry.isIntersecting);

        if (entering) {
          activate(entering.target);

          return;
        }

        // The first report covers every chapter at once.
        if (entries.length >= count) activateNearest();
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
    );

    for (const node of chapters) {
      if (node) observer.observe(node);
    }

    // Scroll restoration lands after the first report, in one jump; ordinary scrolling never moves a whole
    // screen between two events.
    let lastY = globalThis.scrollY;
    const onScroll = () => {
      const y = globalThis.scrollY;
      const jumped = Math.abs(y - lastY) > globalThis.innerHeight;
      lastY = y;

      if (jumped) activateNearest();
    };
    globalThis.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      globalThis.removeEventListener('scroll', onScroll);
    };
  }, [count]);

  const register = (index: number) => (node: HTMLElement | null) => {
    nodes.current[index] = node;
  };

  return { active, register };
};

/**
 * The chapter column. On desktop each chapter is tall enough to hold the reading band for a while and the
 * inactive ones recede — dimmed, never below readable contrast (the titles stay above 3:1 as large text, the
 * bodies above 4.5:1), since they are the story, not disabled controls. Grey on the light page loses contrast
 * faster than on the dark one, so there the bodies recede less (85% against 70%). On narrow screens every chapter stays
 * fully readable with its media above it — or, with `mediaAside`, beside it from tablet width up, where a
 * narrow visual (the phone) would otherwise sit alone in a wide column. Nothing here is announced as
 * "current": the active chapter follows the scroll, not the reader.
 */
export const ChapterList = ({
  chapters,
  active,
  register,
  media,
  mediaAside = false,
}: {
  chapters: readonly Chapter[];
  active: number;
  register: (index: number) => (node: HTMLElement | null) => void;
  /** Inline media for narrow screens (hidden once the pinned visual takes over). */
  media: (index: number) => ReactNode;
  mediaAside?: boolean;
}) => (
  <ol className="relative">
    {chapters.map((chapter, index) => {
      const current = index === active;
      const inline = media(index);

      return (
        <li
          key={chapter.key}
          className={cn(
            'flex flex-col justify-center py-12 lg:min-h-[76vh] lg:py-0',
            mediaAside &&
              'md:flex-row md:items-center md:justify-start md:gap-12 lg:flex-col lg:items-stretch lg:justify-center lg:gap-0'
          )}
        >
          {inline && <div className={cn('mb-8 lg:hidden', mediaAside && 'md:mb-0 md:shrink-0')}>{inline}</div>}
          {/* The text block, not the tall row, is what enters the reading band: the pinned visual switches
              as the words reach the middle of the screen. */}
          <div ref={register(index)} className="min-w-0">
            <p
              className={cn(
                'font-display text-sm font-bold tabular-nums tracking-[0.2em] transition-colors duration-500',
                current ? 'text-brand-700 dark:text-brand-300' : 'text-gray-500'
              )}
            >
              {String(index + 1).padStart(2, '0')}
            </p>
            <h3
              className={cn(
                'mt-3 font-display text-4xl font-bold uppercase leading-none tracking-[-0.01em] text-balance transition-opacity duration-500 sm:text-5xl',
                !current && 'lg:opacity-50'
              )}
            >
              {chapter.title}
            </h3>
            <p
              className={cn(
                'mt-4 max-w-md text-lg leading-relaxed text-gray-400 text-pretty transition-opacity duration-500',
                !current && 'lg:opacity-85 dark:lg:opacity-70'
              )}
            >
              {chapter.body}
            </p>
          </div>
        </li>
      );
    })}
  </ol>
);
