// Single source of truth for the site's languages, its indexable routes and the URL shapes derived
// from them. Before this module the locale list was hand-copied into six places (the i18n init, the
// language helpers, two inline scripts in index.html, the prerender script and Seo.tsx's localized-
// path set) and kept honest by string-matching tests. Everything reads from here now.
//
// Imported from three different module systems, which constrains what may go in it:
//   • app code            `@/config/site`            (Vite / Vitest, alias)
//   • the prerender step  `../src/config/site.ts`    (plain `node scripts/seo-prerender.ts`)
//
// Node runs that script through type-stripping, which applies neither tsconfig path mapping nor
// extensionless resolution — hence the explicit `.ts` specifier there, and hence the rules here:
// NO runtime imports, NO DOM, and erasable syntax only (no enum, no namespace, no parameter
// properties). `tsconfig.node.json` enforces the last one with `erasableSyntaxOnly`.

/** Production domain. Also literal in index.html, public/robots.txt and public/llms.txt. */
export const SITE_URL = 'https://leclap.dev';

// Endonyms — each language labelled in its own tongue, the convention for a language picker (a
// French speaker scans for "Français", not "French"). Order: English first, then by reach.
// `ogLocale` is the BCP-47-ish form Open Graph wants (xx_XX).
export const LOCALES = [
  { code: 'en', nativeName: 'English', ogLocale: 'en_US' },
  { code: 'fr', nativeName: 'Français', ogLocale: 'fr_FR' },
  { code: 'de', nativeName: 'Deutsch', ogLocale: 'de_DE' },
  { code: 'es', nativeName: 'Español', ogLocale: 'es_ES' },
  { code: 'it', nativeName: 'Italiano', ogLocale: 'it_IT' },
] as const;

export type Language = (typeof LOCALES)[number]['code'];

/** English is served at the bare root and is the declared x-default. */
export const DEFAULT_LOCALE: Language = 'en';

export const LOCALE_CODES: readonly Language[] = LOCALES.map((l) => l.code);

/**
 * Every language that carries a URL prefix. English is absent by design: it lives at the root, so
 * each language has its own crawlable URL — the Google-recommended pattern for multilingual SEO.
 */
export const LOCALE_PREFIXES: readonly Language[] = LOCALE_CODES.filter((c) => c !== DEFAULT_LOCALE);

export const OG_LOCALE = Object.fromEntries(LOCALES.map((l) => [l.code, l.ogLocale])) as Record<Language, string>;

/** Where an explicit language choice is remembered (see lib/language.ts). */
export const LANGUAGE_STORAGE_KEY = 'leclap-lang';

/** Absolute URL for `path` in `lng` — English at the root, other languages under a /<lng> prefix. */
export const localeUrl = (lng: Language, path: string): string =>
  lng === DEFAULT_LOCALE ? `${SITE_URL}${path}` : `${SITE_URL}/${lng}${path === '/' ? '' : path}`;

/**
 * Routes whose content is fully translated and therefore published as a distinct URL per language.
 * Only these carry hreflang alternates. `seoKey` selects the copy from each locale's seo.json, so the
 * prerendered <head> and the runtime <Seo> can never disagree; `titleVerbatim` uses the bundle title
 * as-is instead of suffixing " — LeClap" (the home page's title already reads as a full sentence).
 */
export type LocalizedRoute = {
  path: string;
  seoKey: 'default' | 'studio' | 'about' | 'legal' | 'privacy';
  titleVerbatim?: boolean;
  priority: string;
  changefreq: string;
};

export const LOCALIZED_ROUTES: readonly LocalizedRoute[] = [
  { path: '/', seoKey: 'default', titleVerbatim: true, priority: '1.0', changefreq: 'weekly' },
  { path: '/studio', seoKey: 'studio', priority: '0.9', changefreq: 'weekly' },
  { path: '/about', seoKey: 'about', priority: '0.5', changefreq: 'monthly' },
  { path: '/legal', seoKey: 'legal', priority: '0.2', changefreq: 'yearly' },
  { path: '/privacy', seoKey: 'privacy', priority: '0.2', changefreq: 'yearly' },
];

/** The same set as a lookup, for the runtime <Seo> component. */
export const LOCALIZED_PATHS: ReadonlySet<string> = new Set(LOCALIZED_ROUTES.map((r) => r.path));

/**
 * Router paths that are deliberately never indexed: no prerendered file, no sitemap entry, and
 * `noindex` at runtime. Listed here only so the drift test in site.test.ts can prove that every route
 * the router serves was classified as one of localized / doc / unindexed — a new route that nobody
 * thought about fails the test instead of silently never being crawled.
 */
export const UNINDEXED_PATHS: readonly string[] = [
  '/studio/new',
  '/studio/builder',
  '/builder',
  '/projects',
  '/templates',
  '/templates/new',
  '/templates/:id/edit',
  '/partials',
  '/admin',
  '*',
];
