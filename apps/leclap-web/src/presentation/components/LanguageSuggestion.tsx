import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import i18n from '@/i18n';
import { LOCALIZED_PATHS } from '@/config/site';
import { cn } from '@/lib/utils';
import { isBot } from '@/lib/isBot';
import { GlobeIcon } from '@/presentation/components/icons/globe';
import { XIcon } from '@/presentation/components/icons/x';
import { getLanguage, localePath, setStoredLanguage, LANGUAGE_STORAGE_KEY, type Language } from '@/lib/language';
import { pickSuggestedLanguage, SUGGESTION_DISMISSED_KEY } from '@/lib/language-suggestion';

// Offers the visitor their browser's language instead of redirecting them to it. Shown only when
// their top shipped preference differs from what they're reading, and only until they answer it
// once — accepting stores the choice, dismissing stores the refusal, and either way it never asks
// again. An offer rather than an automatic redirect, so the URL someone typed or was sent is still
// the URL they land on.
//
// Copy is read with a locale-pinned `t`, so the offer is written in the language being offered — a
// French speaker looking at the English site reads "Voir ce site en français ?", not English.
//
// Restricted to the routes that actually have a per-language URL (LOCALIZED_PATHS). Two reasons, and
// the second is the load-bearing one: offering "read this page in French" only makes sense where a
// French version of *this page* exists; and RootLayout wraps the working surfaces too, where a fixed
// bar is not a suggestion but an obstruction — the studio editor is `z-30` (`short:z-[60]`), so a
// `z-50` banner would sit over its timeline and compile action on one viewport and vanish behind it
// on another.
export function LanguageSuggestion() {
  const [suggested, setSuggested] = useState<Language | null>(null);
  // Already de-prefixed: the router mounts under a /<lng> basename, so this is the bare route.
  const { pathname } = useLocation();
  const offerable = LOCALIZED_PATHS.has(pathname);

  useEffect(() => {
    // Crawlers must never see chrome that a human would dismiss, and automation would trip over it.
    if (isBot()) {
      return;
    }

    const read = (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null; // storage blocked (private mode) — treat as "never answered"
      }
    };

    setSuggested(
      pickSuggestedLanguage(
        // Typed non-nullable and baseline in every browser we support; the empty-list case is
        // handled by pickSuggestedLanguage rather than by a fallback here.
        navigator.languages,
        getLanguage(),
        read(SUGGESTION_DISMISSED_KEY) !== null,
        read(LANGUAGE_STORAGE_KEY)
      )
    );
  }, []);

  // Gated at render rather than inside the effect, so navigating out of a working surface and back
  // to a localized page restores the offer instead of losing it to a one-shot effect.
  if (!suggested || !offerable) {
    return null;
  }

  const t = i18n.getFixedT(suggested, 'common');
  const prompt = t('languageSuggestion.prompt');
  const dismissLabel = t('languageSuggestion.dismiss');

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

  return (
    // Bottom-anchored and inset, clear of the iOS home indicator. `mx-auto max-w-md` keeps it a card
    // on a wide screen; `inset-x-4` lets it take the width it needs on a phone. Fixed, so it never
    // shifts the hero — the LCP element.
    <aside
      role="region"
      // Every string in here is written in the language being OFFERED, not the one <html lang> says
      // the page is in — without this a screen reader pronounces "Voir ce site en français ?" with
      // an English synthesizer, which is the one sentence the feature exists to convey.
      lang={suggested}
      // A short landmark name, not the prompt: reusing the visible sentence makes a screen reader
      // announce it twice — once naming the region, once reading the paragraph.
      aria-label={t('languageSuggestion.region')}
      className={cn(
        'fixed inset-x-4 z-50 mx-auto max-w-md',
        'bottom-[calc(1rem+env(safe-area-inset-bottom))]',
        'animate-rise-in motion-reduce:animate-none'
      )}
    >
      {/* `glass-panel-dark` is the site's own surface treatment and — despite the name — is
          theme-aware: --glass-bg/--glass-border are redefined in both theme blocks, so this reads as
          frosted light glass in the light theme and smoked glass in the dark one. */}
      <div className="glass-panel-dark flex items-center gap-3 rounded-2xl py-2 pr-2 pl-4 shadow-xl">
        <GlobeIcon className="size-5 shrink-0 text-brand-500" aria-hidden="true" />

        <p className="min-w-0 flex-1 text-sm leading-snug text-balance text-foreground">{prompt}</p>

        <a
          href={`${localePath(suggested, window.location.pathname)}${window.location.search}${window.location.hash}`}
          onClick={accept}
          className={cn(
            // The lavender→pink brand gradient is reserved for primary CTAs, so the one action here
            // wears it — and the dismiss beside it stays unpainted.
            'brand-gradient hover-pop inline-flex min-h-11 shrink-0 items-center rounded-xl px-4',
            'font-display text-xs font-semibold tracking-[0.14em] text-white uppercase',
            'focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none'
          )}
        >
          {t('languageSuggestion.accept')}
        </a>

        {/* Icon-only by design: a second worded button would read as an equal choice to the offer,
            leaving no single primary action. */}
        <button
          type="button"
          aria-label={dismissLabel}
          title={dismissLabel}
          onClick={() => {
            remember();
            setSuggested(null);
          }}
          className={cn(
            'inline-flex size-11 shrink-0 items-center justify-center rounded-xl',
            'text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground',
            'focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none'
          )}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
