// Post-build SEO step. The app is a client-rendered SPA: per-route <title>, description, canonical,
// hreflang and OG/Twitter tags are set by src/presentation/components/Seo.tsx in a useEffect — i.e.
// only after JavaScript runs. Crawlers that don't execute JS (Bing, most social unfurlers, many AI
// bots) would otherwise see the home page's English meta on every route.
//
// This script runs after `vite build`. From route manifests it:
//   1. writes a static <route>/index.html for every indexable route with the route's head meta baked
//      in (title/description/canonical/OG per URL, and the correct <html lang>); and
//   2. for the localized marketing routes, writes one file PER LANGUAGE under its URL prefix
//      (English at the root, others under /<lng>) — each with a self-referencing canonical and a full
//      set of reciprocal hreflang alternates (every language + x-default → English). This is the
//      duplicate-content-safe multilingual setup Google expects: distinct URLs tied by hreflang.
//   3. generates dist/sitemap.xml from the same manifests, with xhtml:link alternates on the
//      localized URLs — so the sitemap can never drift from the routes, and noindex pages are absent.
//
// The body still hydrates via React; only the <head> is pre-baked. Keep SITE_URL / LOCALES / the
// localized-route set in sync with src/presentation/components/Seo.tsx and src/lib/language.ts.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, '..');
const distDir = path.join(appDir, 'dist');
const localesDir = path.join(appDir, 'src/i18n/locales');
const SITE_URL = 'https://leclap.pages.dev';

const LOCALES = ['en', 'fr', 'de', 'es', 'it'] as const;
type Locale = (typeof LOCALES)[number];
const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  fr: 'fr_FR',
  de: 'de_DE',
  es: 'es_ES',
  it: 'it_IT',
};

// Marketing-route copy lives in each locale's seo bundle so it stays in sync with the runtime <Seo>.
const seoByLocale = Object.fromEntries(
  await Promise.all(
    LOCALES.map(async (l) => [l, JSON.parse(await readFile(path.join(localesDir, l, 'seo.json'), 'utf8'))] as const)
  )
) as Record<Locale, { default: SeoEntry; studio: SeoEntry; about: SeoEntry; legal: SeoEntry; privacy: SeoEntry }>;

type SeoEntry = { title: string; description: string };

// Routes that are fully translated and published as a URL per language (hreflang alternates).
// `seoKey` selects the per-locale copy; `titleVerbatim` uses the bundle title as-is (home only).
type MarketingRoute = {
  path: string;
  seoKey: 'default' | 'studio' | 'about' | 'legal' | 'privacy';
  titleVerbatim?: boolean;
  priority: string;
  changefreq: string;
};
const MARKETING_ROUTES: MarketingRoute[] = [
  { path: '/', seoKey: 'default', titleVerbatim: true, priority: '1.0', changefreq: 'weekly' },
  { path: '/studio', seoKey: 'studio', priority: '0.9', changefreq: 'weekly' },
  { path: '/about', seoKey: 'about', priority: '0.5', changefreq: 'monthly' },
  { path: '/legal', seoKey: 'legal', priority: '0.2', changefreq: 'yearly' },
  { path: '/privacy', seoKey: 'privacy', priority: '0.2', changefreq: 'yearly' },
];

// English-only routes (developer reference + design system). Single canonical URL at the root, no
// hreflang — their body content isn't translated, so a localized wrapper would be near-duplicate.
type DocRoute = { path: string; title: string; description: string; priority: string; changefreq: string };
const DOC_ROUTES: DocRoute[] = [
  {
    path: '/doc',
    title: 'Template descriptor — overview',
    description:
      'What the LeClap template descriptor is, the two layers you compose with, how rendering chooses its path, and how to get started with the CLI.',
    priority: '0.7',
    changefreq: 'monthly',
  },
  {
    path: '/doc/sections',
    title: 'Sections & types — template descriptor',
    description:
      'The seven LeClap section types, the base fields every section shares, and the full per-section options surface.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/doc/transitions',
    title: 'Transitions — template descriptor',
    description:
      'The full live catalogue of LeClap transition types — every xfade name plus cut — and the transition field reference.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/doc/looks',
    title: 'Looks — template descriptor',
    description:
      'The named colour-grade presets a LeClap section can apply via the look field, and how they combine with a manual grade.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/doc/grade',
    title: 'Colour grade — template descriptor',
    description:
      'The manual colour-grade controls — brightness, contrast, saturation, gamma, hue, per-range colour balance, blur and curves — layered on top of any look.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/doc/motion',
    title: 'Motion & layers — template descriptor',
    description:
      'Per-section motion effects (Ken Burns, rotate, crop, flip), the recording framing guide, and composited background layers.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/doc/audio',
    title: 'Audio — template descriptor',
    description:
      'The final-mix audio settings — source and music volumes, normalisation, ducking — plus per-section fade curves.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/doc/captions',
    title: 'Captions — template descriptor',
    description:
      'The caption sugar — localized text drawn over a section — and its style, position and alignment options.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/doc/animations',
    title: 'Animations & images — template descriptor',
    description:
      'Animated (APNG / WebM) and still-image overlays composited over a section: formats, position, scale, loop and keep-last-frame.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/doc/filters',
    title: 'Filters & maps — template descriptor',
    description:
      'The raw FFmpeg escape hatch: pass filter names and arguments through verbatim, and wire explicit filtergraph maps for full control.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/doc/examples',
    title: 'Examples — template descriptor',
    description: 'Copy-paste LeClap template descriptors you can save as JSON and render with the CLI.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/doc/schema',
    title: 'JSON Schema — template descriptor',
    description:
      'The full machine-readable JSON Schema for the LeClap template descriptor, for editor tooling and validation.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/design',
    title: 'Design System',
    description: 'The LeClap design system — colors, typography, motion and UI components.',
    priority: '0.6',
    changefreq: 'monthly',
  },
];

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Absolute URL for `path` in `lng` — English at the root, other languages under a /<lng> prefix. */
const localeUrl = (lng: Locale, routePath: string) =>
  lng === 'en' ? `${SITE_URL}${routePath}` : `${SITE_URL}/${lng}${routePath === '/' ? '' : routePath}`;

type HeadSpec = {
  lang: Locale;
  title: string;
  description: string;
  canonical: string;
  /** Marketing routes only: emit reciprocal hreflang for these languages + x-default. */
  alternates: boolean;
  routePath: string;
};

// Swap a head tag's value in place, tolerant of the multi-line attribute formatting Vite preserves.
function patchHead(html: string, spec: HeadSpec) {
  const title = escapeAttr(spec.title);
  const desc = escapeAttr(spec.description);
  const url = escapeAttr(spec.canonical);

  const setMeta = (input: string, attr: string, key: string, value: string) =>
    input.replace(
      new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`),
      (_m: string, p1: string, p2: string) => p1 + value + p2
    );

  const metas: Array<['name' | 'property', string, string]> = [
    ['name', 'description', desc],
    ['property', 'og:title', title],
    ['property', 'og:description', desc],
    ['property', 'og:url', url],
    ['property', 'og:locale', OG_LOCALE[spec.lang]],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', desc],
  ];

  let out = html.replace(/<html lang="[^"]*">/, `<html lang="${spec.lang}">`);
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);

  for (const [attr, key, value] of metas) {
    out = setMeta(out, attr, key, value);
  }

  out = out.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    (_m: string, p1: string, p2: string) => p1 + url + p2
  );

  // Inject the hreflang alternates (+ og:locale:alternate) before </head>. og:locale itself is
  // patched in place above so the template's existing tag isn't duplicated.
  const lines: string[] = [];

  if (spec.alternates) {
    for (const lng of LOCALES) {
      lines.push(`    <link rel="alternate" hreflang="${lng}" href="${escapeAttr(localeUrl(lng, spec.routePath))}" />`);

      if (lng !== spec.lang) {
        lines.push(`    <meta property="og:locale:alternate" content="${OG_LOCALE[lng]}" />`);
      }
    }
    lines.push(
      `    <link rel="alternate" hreflang="x-default" href="${escapeAttr(localeUrl('en', spec.routePath))}" />`
    );
  }

  if (lines.length === 0) {
    return out;
  }

  return out.replace('</head>', `${lines.join('\n')}\n  </head>`);
}

const marketingTitle = (route: MarketingRoute, lng: Locale) => {
  const entry = seoByLocale[lng][route.seoKey];

  return route.titleVerbatim ? entry.title : `${entry.title} — LeClap`;
};

// Where a (route, locale) pair's index.html is written. English keeps the root tree; others nest
// under /<lng>. The English home is dist/index.html itself.
const fileFor = (routePath: string, lng: Locale) => {
  const prefix = lng === 'en' ? '' : `/${lng}`;
  const rel = `${prefix}${routePath === '/' ? '' : routePath}`.replace(/^\//, '');

  return path.join(distDir, rel, 'index.html');
};

function buildSitemap(lastmod: string) {
  const xhtml = (routePath: string) =>
    [
      ...LOCALES.map((lng) => ({ hreflang: lng as string, href: localeUrl(lng, routePath) })),
      { hreflang: 'x-default', href: localeUrl('en', routePath) },
    ]
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
      .join('\n');

  const marketing = MARKETING_ROUTES.flatMap((r) =>
    LOCALES.map(
      (lng) =>
        `  <url>\n    <loc>${localeUrl(lng, r.path)}</loc>\n    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n${xhtml(r.path)}\n  </url>`
    )
  );

  const docs = DOC_ROUTES.map(
    (r) =>
      `  <url>\n    <loc>${SITE_URL}${r.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`
  );

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${[...marketing, ...docs].join('\n')}\n</urlset>\n`
  );
}

const template = await readFile(path.join(distDir, 'index.html'), 'utf8');

// Sanity check: a stale template (wrong domain) would silently bake bad canonicals into every page.
if (!template.includes(SITE_URL)) {
  throw new Error(`dist/index.html does not reference ${SITE_URL} — rebuild before prerendering.`);
}

async function writeFileFor(routePath: string, lng: Locale, spec: HeadSpec) {
  const file = fileFor(routePath, lng);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, patchHead(template, spec));
}

const jobs: Promise<void>[] = [];

for (const route of MARKETING_ROUTES) {
  for (const lng of LOCALES) {
    jobs.push(
      writeFileFor(route.path, lng, {
        lang: lng,
        title: marketingTitle(route, lng),
        description: seoByLocale[lng][route.seoKey].description,
        canonical: localeUrl(lng, route.path),
        alternates: true,
        routePath: route.path,
      })
    );
  }
}

for (const route of DOC_ROUTES) {
  jobs.push(
    writeFileFor(route.path, 'en', {
      lang: 'en',
      title: `${route.title} — LeClap`,
      description: route.description,
      canonical: `${SITE_URL}${route.path}`,
      alternates: false,
      routePath: route.path,
    })
  );
}

const lastmod = new Date().toISOString().slice(0, 10);
jobs.push(writeFile(path.join(distDir, 'sitemap.xml'), buildSitemap(lastmod)));
await Promise.all(jobs);

const localizedFiles = MARKETING_ROUTES.length * LOCALES.length;
const sitemapUrls = MARKETING_ROUTES.length * LOCALES.length + DOC_ROUTES.length;
console.log(
  `seo-prerender: ${localizedFiles} localized + ${DOC_ROUTES.length} doc pages written, ` +
    `sitemap.xml (${sitemapUrls} urls with hreflang alternates).`
);
