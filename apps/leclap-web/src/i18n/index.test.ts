// Guards the lazy locale backend in ./index.ts. The four non-English barrels are reached only
// through a dynamic import whose result is cast to a plain record, so there is no longer a
// compile-time link between i18n and them: rename or delete `locales/de/index.ts` and the import
// rejects, the rejection lands in the `.catch(() => {})` on init, and German visitors are quietly
// served English — with a green typecheck and, without this file, a green test suite too.
//
// So the assertion has to be that a *language-specific* string comes back. Comparing against the
// barrel's own value (rather than a literal) keeps the test from going stale when copy changes,
// while comparing against English proves the fallback isn't what answered.
import { describe, expect, it } from 'vitest';
import i18n, { i18nReady } from './index';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { es } from './locales/es';
import { it as itLocale } from './locales/it';

// `common.actions.back` is translated differently in all five languages, so an English fallback
// leaking through is always visible here.
const LAZY_LOCALES = [
  ['fr', fr.common.actions.back],
  ['de', de.common.actions.back],
  ['es', es.common.actions.back],
  ['it', itLocale.common.actions.back],
] as const;

// Same four barrels, kept whole so the assertions can compare against the real sub-namespace set.
const SEO_LOCALES = [
  ['fr', fr],
  ['de', de],
  ['es', es],
  ['it', itLocale],
] as const;

describe('i18n lazy locale backend', () => {
  it('serves English from the eagerly bundled resources', async () => {
    await i18nReady;

    expect(i18n.t('actions.back', { ns: 'common' })).toBe(en.common.actions.back);
  });

  it.each(LAZY_LOCALES)('loads the %s bundle instead of falling back to English', async (lng, expected) => {
    await i18nReady;
    await i18n.changeLanguage(lng);

    expect(i18n.t('actions.back', { ns: 'common' })).toBe(expected);
    expect(i18n.t('actions.back', { ns: 'common' })).not.toBe(en.common.actions.back);
  });
});

// Regression guard for the `default` unwrap. `i18next-resources-to-backend` resolves a
// promise-returning loader with `callback(null, data && data.default || data)`, and every locale's
// `seo.json` has a top-level `default` key — so a promise loader silently replaces the whole `seo`
// namespace with its `default` sub-object. Typecheck stays green, `t('default.title')` resolves via
// the English fallback, and every non-English page's <title>/<meta> is overwritten with English on
// mount. Only a runtime assertion on the loaded bundle catches it.
describe('i18n seo namespace', () => {
  it.each(SEO_LOCALES)('keeps every %s seo sub-namespace after loading', async (lng, bundle) => {
    await i18nReady;
    await i18n.loadLanguages(lng);

    const loaded = i18n.getResourceBundle(lng, 'seo') as Record<string, unknown>;

    expect(Object.keys(loaded).sort()).toEqual(Object.keys(bundle.seo).sort());
  });

  it.each(SEO_LOCALES)('resolves %s seo.default.title without falling back to English', async (lng, bundle) => {
    await i18nReady;
    await i18n.loadLanguages(lng);

    const t = i18n.getFixedT(lng, 'seo');

    expect(t('default.title')).toBe(bundle.seo.default.title);
    expect(t('default.title')).not.toBe(en.seo.default.title);
  });
});
