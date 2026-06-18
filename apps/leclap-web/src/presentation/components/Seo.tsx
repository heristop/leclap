import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Production domain (also used in index.html, robots.txt, sitemap.xml).
const SITE_URL = 'https://leclap.pages.dev';

type SeoProps = {
  /** Page title; rendered as "<title> — LeClap". Omit on the home page for the default. */
  title?: string;
  description?: string;
  /** Route path (leading slash) used for the canonical + og:url. */
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

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }

  el.setAttribute('href', href);
}

/**
 * Manages document head SEO tags for the current route. Renders nothing.
 * Drop `<Seo title="…" description="…" path="/…" />` at the top of a page.
 */
export function Seo({ title, description, path = '/', noindex = false }: SeoProps): null {
  const { t } = useTranslation('seo');
  const fullTitle = title ? `${title} — LeClap` : t('default.title');
  const desc = description ?? t('default.description');
  const url = `${SITE_URL}${path}`;

  useEffect(() => {
    document.title = fullTitle;
    upsertMeta('name', 'description', desc);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', url);
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', desc);
    upsertCanonical(url);
  }, [fullTitle, desc, url, noindex]);

  return null;
}
