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
