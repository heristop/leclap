import { useLocation } from 'react-router-dom';
import { useNotFound } from './use-not-found';

// The studio browsing pages (gallery / templates / partials) are always-dark app surfaces that fill the
// viewport, like the editor. The shared chrome takes a dark context on them too — the header so its nav stays
// legible in light mode, the footer so the page doesn't end on a light band under a dark app.
const DARK_SURFACE_ROOTS = ['/studio', '/templates', '/partials'];

/**
 * Whether the current page is one of those dark app surfaces. A 404 under one of their roots (/studio/nwe)
 * is not: the not-found page follows the theme.
 */
export const useDarkSurface = (): boolean => {
  const { pathname } = useLocation();
  const notFound = useNotFound();

  return !notFound && DARK_SURFACE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
};
