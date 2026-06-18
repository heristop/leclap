// Post-build SEO step. The app is a client-rendered SPA: per-route <title>, description, canonical
// and OG/Twitter tags are set by src/presentation/components/Seo.tsx in a useEffect — i.e. only after
// JavaScript runs. Crawlers that don't execute JS (Bing, most social unfurlers, many AI bots) would
// otherwise see the home page's meta on every route.
//
// This script runs after `vite build`. From a single ROUTES manifest it:
//   1. writes a static dist/<route>/index.html for every indexable route, with the route's head meta
//      baked in (so non-JS crawlers get the right title/description/canonical/OG per URL); and
//   2. generates dist/sitemap.xml from the same manifest — so the sitemap can never drift from the
//      routes, and noindex/private pages are never listed.
//
// The body still hydrates via React for real users; only the <head> is pre-baked. Run from the app
// dir: `node scripts/seo-prerender.ts` (wired into the `build` script).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, '..');
const distDir = path.join(appDir, 'dist');
const SITE_URL = 'https://leclap.pages.dev';

// Marketing-route copy lives in the seo locale so it stays in sync with the runtime <Seo> defaults.
const seo = JSON.parse(await readFile(path.join(appDir, 'src/i18n/locales/en/seo.json'), 'utf8'));

type Route = {
  path: string;
  /** `null` → use the home default title verbatim; otherwise rendered as "<title> — LeClap". */
  title: string | null;
  description: string;
  priority: string;
  changefreq: string;
};

// The indexable routes. `title: null` → use the home default verbatim; otherwise the runtime renders
// "<title> — LeClap", mirrored here. Private/noindex routes (/templates, /projects, /partials) and
// redirects (/admin, /builder) are intentionally absent — they get neither a prerender nor a sitemap entry.
const ROUTES: Route[] = [
  { path: '/', title: null, description: seo.default.description, priority: '1.0', changefreq: 'weekly' },
  {
    path: '/studio',
    title: seo.studio.title,
    description: seo.studio.description,
    priority: '0.9',
    changefreq: 'weekly',
  },
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
  {
    path: '/about',
    title: seo.about.title,
    description: seo.about.description,
    priority: '0.5',
    changefreq: 'monthly',
  },
];

const fullTitle = (route: Route) => (route.title === null ? seo.default.title : `${route.title} — LeClap`);

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Swap a head tag's value in place, tolerant of the multi-line attribute formatting Vite preserves.
// Each helper takes (m, p1, p2) and rebuilds around the new value so literal `$` in copy is safe.
function patchHead(html: string, route: Route) {
  const title = escapeAttr(fullTitle(route));
  const desc = escapeAttr(route.description);
  const url = escapeAttr(`${SITE_URL}${route.path}`);

  const setMeta = (input: string, attr: string, key: string, value: string) =>
    input.replace(
      new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`),
      (_m: string, p1: string, p2: string) => p1 + value + p2
    );

  let out = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  out = setMeta(out, 'name', 'description', desc);
  out = setMeta(out, 'property', 'og:title', title);
  out = setMeta(out, 'property', 'og:description', desc);
  out = setMeta(out, 'property', 'og:url', url);
  out = setMeta(out, 'name', 'twitter:title', title);
  out = setMeta(out, 'name', 'twitter:description', desc);
  out = out.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    (_m: string, p1: string, p2: string) => p1 + url + p2
  );

  return out;
}

function buildSitemap(lastmod: string) {
  const entries = ROUTES.map(
    (r) =>
      `  <url>\n    <loc>${SITE_URL}${r.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

const template = await readFile(path.join(distDir, 'index.html'), 'utf8');

// Sanity check: a stale template (wrong domain) would silently bake bad canonicals into every page.
if (!template.includes(SITE_URL)) {
  throw new Error(`dist/index.html does not reference ${SITE_URL} — rebuild before prerendering.`);
}

// dist/index.html is already the home page; prerender every other route into its own directory.
const prerenderRoutes = ROUTES.filter((route) => route.path !== '/');

async function writeRoute(route: Route) {
  const dir = path.join(distDir, route.path.replace(/^\//, ''));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), patchHead(template, route));
}

const lastmod = new Date().toISOString().slice(0, 10);
await Promise.all([
  ...prerenderRoutes.map(writeRoute),
  writeFile(path.join(distDir, 'sitemap.xml'), buildSitemap(lastmod)),
]);

console.log(
  `seo-prerender: ${prerenderRoutes.length} routes prerendered, sitemap.xml written (${ROUTES.length} urls).`
);
