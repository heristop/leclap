import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import i18n from '@/i18n';
import { LOCALIZED_PATHS } from '@/config/site';
import { cn } from '@/lib/utils';
import { isBot } from '@/lib/isBot';
import { GlobeIcon } from '@/presentation/components/icons/globe';
import { ChevronRightIcon } from '@/presentation/components/icons/chevron-right';
import { XIcon } from '@/presentation/components/icons/x';
import { getLanguage, localePath, setStoredLanguage, LANGUAGE_STORAGE_KEY, type Language } from '@/lib/language';
import {
  pickSuggestedLanguage,
  resolveOfferCopy,
  SUGGESTION_DISMISSED_KEY,
  type OfferCopy,
} from '@/lib/language-suggestion';

// Offers the visitor their browser's language instead of redirecting them to it. Shown only when
// their top shipped preference differs from what they're reading, and only until they answer it
// once — accepting stores the choice, dismissing stores the refusal, and either way it never asks
// again. An offer rather than an automatic redirect, so the URL someone typed or was sent is still
// the URL they land on.
//
// Copy is read with a locale-pinned `t`, so the offer is written in the language being offered — a
// French speaker looking at the English site reads "Tu lis ce site en English…", not English.
//
// Restricted to the routes that actually have a per-language URL (LOCALIZED_PATHS). Two reasons, and
// the second is the load-bearing one: offering "read this page in French" only makes sense where a
// French version of *this page* exists; and RootLayout wraps the working surfaces too, where a fixed
// bar is not a suggestion but an obstruction — the studio editor is `z-30` (`short:z-[60]`), so a
// `z-50` banner would sit over its timeline and compile action on one viewport and vanish behind it
// on another.
//
// The card names both languages — the one being read and the one on offer — because "View this site
// in French?" answers only half the question a visitor who landed on the wrong locale is asking. The
// two names are the only words that matter, so they are marked in the copy and drawn stronger; the
// EN → FR chips below repeat that pair wordlessly, and are `aria-hidden` because they are a second
// telling of the sentence, not a second piece of information.
//
// Because the sentence holds words from two languages, `lang` cannot be a single attribute on the
// card: each name carries its own (see composeOffer), and the card's own attribute names the language
// the *prose* is in — which is English whenever the offered locale's copy is not in the store.
//
// The resolved copy IS the state. It is not derived at render from a `t` looked up on the fly,
// because that made the card's words and its `lang` two separate decisions taken at two different
// moments: the card painted from the English fallback, labelled itself with the offered language, and
// — being painted exactly once — stayed that way for the session. Resolving both together and storing
// the result means a repaint is the only way the copy can change, and every repaint re-decides both.

/** The offer, once decided: which language is on offer, and the copy the card is currently painting. */
type Offer = { readonly language: Language; readonly copy: OfferCopy };

/**
 * Bind `resolveOfferCopy` to the live i18next store.
 *
 * `hasResourceBundle` is the load question's only honest answer. `loadLanguages()` resolves
 * immediately for any language already in `options.preload` — which every second call in a session
 * is, and StrictMode's double-invoked effect plus any remount of this component both produce a second
 * call — so its promise reports success while the chunk is still in flight.
 */
const readOfferCopy = (current: Language, suggested: Language): OfferCopy =>
  resolveOfferCopy(current, suggested, i18n.hasResourceBundle(suggested, 'common'), (lng, key, options) =>
    i18n.getFixedT(lng, 'common')(key, options)
  );

export function LanguageSuggestion() {
  const [offer, setOffer] = useState<Offer | null>(null);
  // Already de-prefixed: the router mounts under a /<lng> basename, so this is the bare route.
  const { pathname } = useLocation();
  const offerable = LOCALIZED_PATHS.has(pathname);

  useEffect(() => {
    // Deciding whether to offer is now asynchronous — the offered locale's copy has to be fetched
    // before the card can be shown in it — so the effect always returns the same cleanup and does its
    // bailing inside `decide`, where an early return costs nothing.
    let live = true;
    // Set by `decide` only when it subscribes to i18next; the no-op covers every path that bails out
    // before there is anything to unsubscribe.
    let cleanup = (): void => {};

    const read = (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null; // storage blocked (private mode) — treat as "never answered"
      }
    };

    const decide = (): void => {
      // Crawlers must never see chrome that a human would dismiss, and automation would trip over it.
      if (isBot()) {
        return;
      }

      const next = pickSuggestedLanguage(
        // Typed non-nullable and baseline in every browser we support; the empty-list case is
        // handled by pickSuggestedLanguage rather than by a fallback here.
        navigator.languages,
        getLanguage(),
        read(SUGGESTION_DISMISSED_KEY) !== null,
        read(LANGUAGE_STORAGE_KEY)
      );

      if (!next) {
        return;
      }

      // Re-resolve the copy against the store as it is right now and paint that. Called on every
      // event that can change the answer, so the card cannot get stuck in a language it was painted
      // in before its own words arrived.
      const paint = (): void => {
        if (live) {
          setOffer({ language: next, copy: readOfferCopy(getLanguage(), next) });
        }
      };

      // Exactly one locale bundle is ever loaded per session — the page's own (see i18n/index.ts) —
      // and `getFixedT` reads that store rather than filling it. Without this the offer renders
      // through the English fallback, i.e. in the very language the visitor is being offered an
      // escape from.
      //
      // `loaded` is what actually turns an English card into a French one: the promise below can
      // resolve before the chunk is in the store (see readOfferCopy), so it is the arrival of the
      // bundle, not the settling of the promise, that has to trigger the repaint. The promise still
      // paints — it is what shows the card at all when the bundle is already there, and what shows it
      // in English when the chunk genuinely failed. A failed chunk is no reason to withhold the
      // offer: the copy degrades to English, says so in its `lang`, and the link it carries — the
      // part that has to work — does not degrade at all.
      i18n.on('loaded', paint);
      i18n.loadLanguages(next).then(paint, paint);

      cleanup = () => {
        i18n.off('loaded', paint);
      };
    };

    decide();

    return () => {
      live = false;
      cleanup();
    };
  }, []);

  // Gated at render rather than inside the effect, so navigating out of a working surface and back
  // to a localized page restores the offer instead of losing it to a one-shot effect.
  if (!offer || !offerable) {
    return null;
  }

  const suggested = offer.language;
  const current = getLanguage();
  // Every string below comes out of this one value, resolved together with the `lang` that labels it
  // (see resolveOfferCopy). Nothing here re-reads i18next: a second lookup at render time is how the
  // words and the attribute got to disagree in the first place.
  const { copy } = offer;
  const dismissLabel = copy.dismiss;

  const remember = (): void => {
    try {
      localStorage.setItem(SUGGESTION_DISMISSED_KEY, '1');
    } catch {
      /* storage unavailable — the banner reappears next visit, which is merely mildly annoying */
    }
  };

  const accept = (): void => {
    setStoredLanguage(suggested);
    remember();
  };

  // A circle carrying the uppercase language code, not a flag. Regional-indicator emoji render as
  // two letter boxes on Windows Chrome and Edge — a third of desktop visitors would see the broken
  // form of the one element that carries meaning without words. A code chip also sidesteps the
  // category error in flagging a language with a country: this site's English serves the UK, India
  // and Australia as much as the US, and there is no flag for that.
  const chip = cn(
    'inline-flex size-7 items-center justify-center rounded-full border',
    'font-display text-xs leading-none font-semibold tracking-wider'
  );

  // One focus treatment for both controls. The app's usual `ring-brand-500/40` is legible on an
  // unpainted surface but all but disappears on the gradient button, which is brand-500 itself — so
  // this is a full-strength outline with a gap, stepped per theme to clear 3:1 against both glasses.
  const focusRing =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400';

  return (
    // Bottom-anchored and inset, clear of the iOS home indicator. `mx-auto max-w-md` keeps it a card
    // on a wide screen; `inset-x-4` lets it take the width it needs on a phone. Fixed, so it never
    // shifts the hero — the LCP element.
    <aside
      role="region"
      // The prose in here is written in the language being OFFERED, not the one <html lang> says the
      // page is in — without this a screen reader reads the offer with the wrong synthesizer, which
      // is the one sentence the feature exists to convey. The two language *names* inside the
      // sentence carry their own `lang` below, since each is a word in its own language; and if the
      // offered locale's chunk failed, this says `en`, because that is what the words then are.
      lang={copy.lang}
      // A short landmark name, not the prompt: reusing the visible sentence makes a screen reader
      // announce it twice — once naming the region, once reading the paragraph.
      aria-label={copy.region}
      className={cn(
        'fixed inset-x-4 z-50 mx-auto max-w-md',
        'bottom-[calc(1rem+env(safe-area-inset-bottom))]',
        'animate-rise-in motion-reduce:animate-none'
      )}
    >
      {/* `glass-panel-dark` is the site's own surface treatment and — despite the name — is
          theme-aware: --glass-bg/--glass-border are redefined in both theme blocks, so this reads as
          frosted light glass in the light theme and smoked glass in the dark one.
          No hover state on the card itself: nothing about it is clickable, and a surface that
          responds to the pointer promises an action it does not have.
          `--shadow-raised` rather than a neutral `shadow-xl`: it is the design system's own top step
          of elevation, and it is tinted lavender, so the card lifts off the page in the brand's hue
          instead of casting a grey rectangle. */}
      <div className="glass-panel-dark relative rounded-2xl shadow-[var(--shadow-raised)]">
        {/* Outside the content flow, in the corner the eye already checks for a way out, and
            optically centred on the title row beside it. Drawn at 36px — a 44px circle would out-weigh
            the title — and padded back out to a 44px hit area by `before`, so the thumb target meets
            the touch minimum without the visible ring growing to match. */}
        <button
          type="button"
          aria-label={dismissLabel}
          title={dismissLabel}
          onClick={() => {
            remember();
            setOffer(null);
          }}
          className={cn(
            'absolute top-2 right-2 inline-flex size-9 cursor-pointer items-center justify-center rounded-full',
            'before:absolute before:-inset-1 before:content-[""]',
            'border border-divider text-muted-foreground transition-colors duration-200',
            'hover:bg-foreground/8 hover:text-foreground active:bg-foreground/15',
            focusRing
          )}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>

        <div className="p-4 sm:p-5">
          {/* `pr-9` keeps the title clear of the close button that overlaps this row. */}
          <div className="flex items-center gap-2 pr-9">
            <GlobeIcon className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <h2 className="font-display text-base leading-tight font-bold tracking-tight text-foreground">
              {copy.title}
            </h2>
          </div>

          {/* `text-pretty` rather than `text-balance`: this is two sentences, and balancing them
              evens out line lengths at the cost of leaving the second one visibly short. */}
          <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
            {copy.body.map((run, index) =>
              run.lang ? (
                <strong key={index} lang={run.lang} className="font-semibold text-foreground">
                  {run.text}
                </strong>
              ) : (
                <span key={index}>{run.text}</span>
              )
            )}
          </p>
        </div>

        {/* The divider earns its place by being the seam between two blocks rather than a line drawn
            inside one: it runs the full width of the card because the footer is its own section, and
            it is drawn in the card's own border token so it reads as the same material as the edge.
            `flex-wrap` is the escape hatch for the long labels — German's "Auf Deutsch wechseln" next
            to the chips is close to the inner width of a 375px phone, and wrapping puts the action on
            its own right-aligned line rather than squeezing it. */}
        <div className="flex flex-wrap items-center gap-3 border-t border-divider px-4 py-3 sm:px-5">
          <span aria-hidden="true" className="flex shrink-0 items-center gap-1.5">
            <span className={cn(chip, 'border-divider bg-foreground/5 text-muted-foreground')}>
              {current.toUpperCase()}
            </span>
            <ChevronRightIcon size={14} className="text-muted-foreground/70" />
            <span className={cn(chip, 'border-brand-500/50 bg-brand-500/15 text-foreground')}>
              {suggested.toUpperCase()}
            </span>
          </span>

          <a
            href={`${localePath(suggested, window.location.pathname)}${window.location.search}${window.location.hash}`}
            onClick={accept}
            className={cn(
              // The lavender→pink brand gradient is reserved for primary CTAs, so the one action here
              // wears it — and the dismiss beside it stays unpainted. It is the only gradient on the
              // card: the target chip is tinted with the same brand hue but left flat, so the eye
              // still lands on the button first.
              'brand-gradient hover-pop ml-auto inline-flex min-h-11 shrink-0 items-center rounded-xl px-4',
              'font-display text-xs font-semibold tracking-[0.14em] text-white uppercase',
              // Press feedback as a filter rather than a transform: `hover-pop` already owns this
              // element's transform, and a competing `active:scale` would fight it mid-transition.
              'active:brightness-95',
              focusRing
            )}
          >
            {copy.accept}
          </a>
        </div>
      </div>
    </aside>
  );
}
