import { useEffect, useState, type RefObject } from 'react';
import { activeHeadingId } from './doc-nav.logic';

export interface TocItem {
  id: string;
  label: string;
  level: 2 | 3;
  // RefTable titles are schema names (`inputs[]`, `audio (global)`) and keep their mono face here.
  code: boolean;
}

// DocSection, RefTable and the examples opt in with `data-toc-level`, so the list is read from the
// page as rendered — no second copy of every page's outline to drift from its headings.
const TOC_SELECTOR = '[data-toc-level]';

// A jump parks a heading on its anchor line; sub-pixel rounding can leave it a hair below.
const LANDING_SLACK = 8;

const tocItemOf = (target: HTMLElement): TocItem | null => {
  const heading = target.querySelector('h2, h3');
  // The permalink "#" is part of the heading's text; it is not part of its name.
  const label = (heading?.textContent ?? '').replace(/\s*#$/, '').trim();

  if (!heading || !target.id || !label) return null;

  return {
    id: target.id,
    label,
    level: target.dataset.tocLevel === '3' ? 3 : 2,
    code: heading.classList.contains('font-mono'),
  };
};

// Where an anchor jump parks a section: the root's scroll-padding (the fixed header) plus the
// section's own scroll-margin (the phone doc bar). Read live, so it follows the breakpoint.
const landingLine = (target: HTMLElement): number => {
  const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;

  return padding + margin + LANDING_SLACK;
};

const isAtBottom = (): boolean =>
  window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - LANDING_SLACK;

// The "On this page" entries for the doc page under `contentRef`, and the one being read. Re-collected
// whenever the page changes (`pageKey`); the active entry is re-measured at most once per frame.
export function useDocToc(
  contentRef: RefObject<HTMLElement | null>,
  pageKey: string
): { items: TocItem[]; activeId: string | null } {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const root = contentRef.current;

    if (!root) return () => {};

    const entries = [...root.querySelectorAll<HTMLElement>(TOC_SELECTOR)].flatMap((target) => {
      const item = tocItemOf(target);

      return item ? [{ target, item }] : [];
    });
    let frame = 0;

    const measure = () => {
      frame = 0;
      const first = entries.at(0);

      if (!first) {
        setActiveId(null);

        return;
      }

      const positions = entries.map(({ target }) => ({ id: target.id, top: target.getBoundingClientRect().top }));

      setActiveId(activeHeadingId(positions, landingLine(first.target), isAtBottom()));
    };

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    setItems(entries.map(({ item }) => item));
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [contentRef, pageKey]);

  return { items, activeId };
}
