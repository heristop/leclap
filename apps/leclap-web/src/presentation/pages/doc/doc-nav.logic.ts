// Pure wayfinding for the docs: which page a path is, its neighbours in reading order, and which
// section of it the reader is in. No React and no DOM, so every rule here unit-tests in node.
import type { DocNavItem } from './docNav';

export interface DocPager {
  prev: DocNavItem | null;
  next: DocNavItem | null;
}

/** A position measured off the viewport top, in DOM order — the input the scroll-spy reads. */
export interface HeadingPosition {
  id: string;
  top: number;
}

// A router path may carry a trailing slash (`/doc/`) that names the same page as `/doc`.
export function normalizeDocPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);

  return pathname;
}

export function docPageAt(items: readonly DocNavItem[], pathname: string): DocNavItem | null {
  const path = normalizeDocPath(pathname);

  return items.find((item) => item.to === path) ?? null;
}

export function docPager(items: readonly DocNavItem[], pathname: string): DocPager {
  const path = normalizeDocPath(pathname);
  const index = items.findIndex((item) => item.to === path);

  if (index === -1) return { prev: null, next: null };

  // `at(-1)` would wrap round to the last page, so the first page is guarded explicitly.
  const prev = index > 0 ? (items.at(index - 1) ?? null) : null;

  return { prev, next: items.at(index + 1) ?? null };
}

// The section being read is the last one whose heading has scrolled up past `threshold` (the line
// just under the sticky chrome where an anchor jump parks a heading). Above the first heading the
// reader is still in the page intro, so nothing is current. At the very bottom the last heading wins:
// a short closing section can never scroll up to the threshold, and would otherwise never light up.
export function activeHeadingId(
  headings: readonly HeadingPosition[],
  threshold: number,
  atBottom: boolean
): string | null {
  const last = headings.at(-1);

  if (!last) return null;

  if (atBottom) return last.id;

  const passed = headings.filter((heading) => heading.top <= threshold);

  return passed.at(-1)?.id ?? null;
}
