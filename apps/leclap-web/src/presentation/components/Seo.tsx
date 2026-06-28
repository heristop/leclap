import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getLanguage, LANGUAGES, LOCALE_PREFIXES, type Language } from '@/lib/language';

// Production domain (also used in index.html, robots.txt, sitemap.xml, scripts/seo-prerender.ts).
const SITE_URL = 'https://leclap.pages.dev';

// Routes whose content is fully translated and therefore published as a distinct URL per language
// (English at the root, others under /<lng>). Only these carry hreflang alternates. Everything else
// (the English-only /doc reference, /design, …) canonicalizes to its English root URL so a localized
// chrome wrapper around English content is never indexed as a separate, near-duplicate page.
const LOCALIZED_PATHS = new Set(['/', '/studio', '/about']);

// BCP-47-ish locales for Open Graph (og:locale wants xx_XX).
const OG_LOCALE: Record<Language, string> = {
  en: 'en_US',
  fr: 'fr_FR',
  de: 'de_DE',
  es: 'es_ES',
  it: 'it_IT',
};

/** Absolute URL for `path` in `lng` — English at the root, other languages under a /<lng> prefix. */
function localeUrl(lng: Language, path: string): string {
  if (lng === 'en') {
    return `${SITE_URL}${path}`;
  }

  return `${SITE_URL}/${lng}${path === '/' ? '' : path}`;
}

type SeoProps = {
  /** Page title; rendered as "<title> — LeClap". Omit on the home page for the default. */
  title?: string;
  description?: string;
  /** Logical route path (leading slash, no locale prefix) used for the canonical + alternates. */
  path?: string;
  /** Keep this route out of the index (private/utility pages). */
  noindex?: boolean;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);

  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }

  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, hreflang?: string): void {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);

  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);

    if (hreflang) {
      el.setAttribute('hreflang', hreflang);
    }

    document.head.appendChild(el);
  }

  el.setAttribute('href', href);
}

/** Append a fresh meta element (for repeatable properties like og:locale:alternate). */
function appendMeta(property: string, content: string): void {
  const el = document.createElement('meta');
  el.setAttribute('property', property);
  el.setAttribute('content', content);
  document.head.appendChild(el);
}

/** Drop every hreflang alternate — called before re-emitting so stale ones don't survive SPA nav. */
function clearAlternates(): void {
  const stale = document.head.querySelectorAll('link[rel="alternate"][hreflang], meta[property="og:locale:alternate"]');

  for (const el of stale) {
    el.remove();
  }
}

/**
 * Manages document head SEO tags for the current route. Renders nothing.
 * Drop `<Seo title="…" description="…" path="/…" />` at the top of a page.
 *
 * For the localized marketing routes it emits per-language URLs: a self-referencing canonical, a full
 * set of `hreflang` alternates (every language + `x-default` → English), and `og:locale`. Other routes
 * canonicalize to their English root URL. This is the duplicate-content-safe multilingual setup Google
 * expects — distinct URLs tied together by reciprocal hreflang rather than many URLs of similar content.
 */
export function Seo({ title, description, path = '/', noindex = false }: SeoProps): null {
  const { t } = useTranslation('seo');
  const lng = getLanguage();
  const fullTitle = title ? `${title} — LeClap` : t('default.title');
  const desc = description ?? t('default.description');
  const localized = LOCALIZED_PATHS.has(path);
  const canonical = localized ? localeUrl(lng, path) : `${SITE_URL}${path}`;
  // A non-localized route reached under a locale prefix (e.g. /es/templates, /fr/doc) is a duplicate
  // of its English root URL. The canonical already points there; noindexing the prefixed variant too
  // means only the single root URL can ever be indexed.
  const prefixedDuplicate =
    !localized &&
    typeof window !== 'undefined' &&
    LOCALE_PREFIXES.includes(window.location.pathname.split('/')[1] as Language);
  const effectiveNoindex = noindex || prefixedDuplicate;

  useEffect(() => {
    document.title = fullTitle;
    upsertMeta('name', 'description', desc);
    upsertMeta('name', 'robots', effectiveNoindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:locale', OG_LOCALE[lng]);
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', desc);
    upsertLink('canonical', canonical);

    clearAlternates();

    if (!localized || effectiveNoindex) {
      return;
    }

    // Reciprocal hreflang: one alternate per language plus x-default → English. Every localized URL
    // lists the same complete set (including itself), which is what Google requires.
    for (const { code } of LANGUAGES) {
      upsertLink('alternate', localeUrl(code, path), code);

      if (code !== lng) {
        appendMeta('og:locale:alternate', OG_LOCALE[code]);
      }
    }
    upsertLink('alternate', localeUrl('en', path), 'x-default');
  }, [fullTitle, desc, canonical, effectiveNoindex, localized, lng, path]);

  return null;
}
