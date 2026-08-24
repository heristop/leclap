// The load sequence the suggestion card actually goes through, pinned end to end.
//
// This lives in its own file on purpose: `i18n.loadLanguages()` mutates `options.preload` on the
// shared instance, so a file that has already loaded a locale can no longer observe the window this
// test is about. A fresh module registry means nothing but English is in the store when it starts.
//
// The bug it pins: the card asked the *load promise* whether the offered copy had arrived.
// `loadLanguages()` returns an already-resolved promise for any language in `options.preload`, and
// the second call in a session always is one — StrictMode double-invokes the effect in dev, and any
// remount does it in production. So the promise reported success with the chunk still in flight, the
// card painted English under `lang="fr"`, and because it painted exactly once it stayed that way.
import { describe, expect, it } from 'vitest';
import i18n, { i18nReady } from '@/i18n';
import { resolveOfferCopy, type OfferTranslate } from './language-suggestion';
import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';

const read: OfferTranslate = (lng, key, options) => i18n.getFixedT(lng, 'common')(key, options);

/** What the component resolves, with the load question answered by the store — as it now is. */
const cardCopy = () => resolveOfferCopy('en', 'es', i18n.hasResourceBundle('es', 'common'), read);

describe('the suggestion card across the locale load', () => {
  it('stays honest before the bundle lands and upgrades once it does', async () => {
    await i18nReady;

    // The first effect run starts the real load and puts `es` into options.preload.
    const realLoad = i18n.loadLanguages('es');
    // The second run's call — this is the one whose promise lies.
    await i18n.loadLanguages('es');

    expect(i18n.hasResourceBundle('es', 'common')).toBe(false);

    // Painting here is what the live card did. Asking the store rather than the promise, the copy is
    // English AND says so — never Spanish prose's `lang` over English words.
    const early = cardCopy();

    expect(early.lang).toBe('en');
    expect(early.title).toBe(en.common.languageSuggestion.title);

    // The bundle arrives. i18next emits `loaded`, the component repaints, and this is what it gets.
    await realLoad;

    expect(i18n.hasResourceBundle('es', 'common')).toBe(true);

    const late = cardCopy();

    expect(late.lang).toBe('es');
    expect(late.title).toBe(es.common.languageSuggestion.title);
    expect(late.title).not.toBe(en.common.languageSuggestion.title);
  });

  // The repaint has to be driven by something. `loaded` is that something, so if i18next ever stops
  // emitting it for a lazily loaded namespace the card would silently freeze in English again.
  it('emits `loaded` when a lazily fetched bundle arrives', async () => {
    await i18nReady;

    const fired = new Promise<boolean>((resolve) => {
      i18n.once('loaded', () => {
        resolve(true);
      });
    });

    await i18n.loadLanguages('it');

    await expect(fired).resolves.toBe(true);
    expect(i18n.hasResourceBundle('it', 'common')).toBe(true);
  });
});
