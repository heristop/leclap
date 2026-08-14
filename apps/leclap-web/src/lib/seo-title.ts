import { TITLE_VERBATIM_PATHS } from '@/config/site';

/**
 * The document title for a route, matching what scripts/seo-prerender.ts bakes in: the page title
 * suffixed with the brand, unless the route declared itself `titleVerbatim` in the site manifest
 * because its bundle title already reads as a full sentence.
 *
 * `routePath` is the path the caller passed **explicitly**, not `<Seo>`'s `'/'` default. Verbatim
 * treatment has to be something a route opts into, never something a page inherits by omitting a
 * prop: the 404 renders `<Seo title={…} noindex />` with no path at all, and reading that as "the
 * home page" would silently drop the brand from its title. Pass `undefined` and you get the suffix.
 */
export function documentTitle(title: string | undefined, routePath: string | undefined, fallback: string): string {
  if (!title) {
    return fallback;
  }

  if (routePath !== undefined && TITLE_VERBATIM_PATHS.has(routePath)) {
    return title;
  }

  return `${title} — LeClap`;
}
