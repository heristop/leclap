import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CheckIcon } from '@/presentation/components/icons/check';
import { ShieldCheckIcon } from '@/presentation/components/icons/shield-check';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import type { ConsentChoice } from '@/lib/analytics';

// Asks before anything is measured: gtag.js is not on the page yet, so declining costs zero requests
// to Google — which is what lets the copy promise it.
//
// A parallel ask, not a modal — no scrim, no focus trap, the page stays usable. Dimming would imply
// this has to be settled before reading. Shares the bottom slot with <LanguageSuggestion>.
type ConsentBannerProps = { onAnswer: (choice: ConsentChoice) => void };

// Matches the enter animation's duration (--animate-rise-in) so the bar leaves the way it arrived.
const EXIT_MS = 260;

const TITLE_ID = 'consent-title';

export function ConsentBanner({ onAnswer }: ConsentBannerProps) {
  const { t } = useTranslation('common');
  const [leaving, setLeaving] = useState(false);
  // Driven from the button, not the glyph: the check draws itself whenever the whole control is hovered.
  const { ref: checkRef, hoverProps: checkHoverProps } = useIconHover();

  // It rose from the bottom edge, so it sinks back to it. The answer lands once the bar is out of the
  // way — nothing is measured during those 260ms either way.
  const answer = (choice: ConsentChoice): void => {
    setLeaving(true);
    window.setTimeout(() => {
      onAnswer(choice);
    }, EXIT_MS);
  };

  return (
    <aside
      role="region"
      // Named by its own heading, so the landmark announces "Privacy-first" rather than repeating the
      // whole paragraph a screen reader is about to read anyway.
      aria-labelledby={TITLE_ID}
      className={cn(
        'fixed inset-x-4 z-50 mx-auto max-w-lg',
        'bottom-[calc(1rem+env(safe-area-inset-bottom))]',
        'transition-[opacity,transform] duration-[260ms] ease-out',
        leaving ? 'translate-y-6 opacity-0' : 'animate-rise-in',
        'motion-reduce:animate-none motion-reduce:transition-opacity motion-reduce:translate-y-0'
      )}
    >
      {/* Deliberately not `glass-panel-dark`: at 62% alpha that surface takes on whatever is behind
          it, and a bar pinned to the bottom of the home page lands exactly on the seam between the
          dark hero and the light section below — turning muddy grey and dragging the text with it.
          So: near-opaque surface, real border, and a shadow deep enough to separate it from busy
          content. Blur still runs, so it reads as material rather than a flat slab. */}
      <div
        className={cn(
          'rounded-2xl border border-foreground/10 bg-surface-2/95 p-4 backdrop-blur-xl sm:p-5',
          // A phone in landscape has ~360px of height to give: the bar keeps its words but spends less
          // room on padding and leading, so it stays a bar instead of becoming half the screen.
          'short:p-3',
          // Bright inset top edge — light catching the near side of the material — over a deep,
          // wide shadow. Muted in the dark theme, where a white edge at 50% would read as a seam.
          'shadow-[inset_0_1px_0_oklch(1_0_0/0.6),0_20px_50px_-16px_oklch(0_0_0/0.35)]',
          'dark:border-foreground/15 dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.08),0_24px_60px_-16px_oklch(0_0_0/0.7)]'
        )}
      >
        <div className="flex items-start gap-3.5">
          {/* The policy pages' section-icon chip, one step more solid: those sit on the forced-dark
              studio surface, where a 10% tint and brand-400 have contrast they lack on light glass. */}
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-600 ring-1 ring-brand-500/30 dark:text-brand-300">
            <ShieldCheckIcon className="size-[1.125rem]" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            {/* The site's kicker treatment, and the same words the policy page wears as its badge. */}
            <h2
              id={TITLE_ID}
              className="font-display text-[0.6875rem] font-semibold tracking-[0.16em] text-brand-600 uppercase dark:text-brand-300"
            >
              {t('consent.title')}
            </h2>

            {/* font-medium, not regular: this is the one paragraph on the page that has to be read
                before it can be answered. */}
            <p className="mt-1.5 text-sm leading-relaxed font-medium text-pretty text-foreground short:mt-1 short:text-[0.8125rem] short:leading-snug">
              {t('consent.text')}
            </p>
          </div>
        </div>

        {/* Wraps rather than switching layout at a breakpoint: the buttons travel as one unit, so the
            link drops to its own line exactly on the phones where the three of them stop fitting (~360px
            and below) and shares the row everywhere else, instead of costing every phone a row. */}
        <div className="mt-4 flex flex-wrap items-center gap-3 short:mt-2.5 sm:gap-2">
          <Link
            to="/privacy"
            className="mr-auto inline-flex min-h-11 items-center px-1 text-xs text-foreground/70 underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground short:min-h-9"
          >
            {t('footerNav.privacy')}
          </Link>

          {/* Decline is a peer of Accept — same height, same hit area — because a refusal that is harder
              to give than a consent is not a real choice; only the fill differs. Widths are not peers
              though: the CTA takes what its label needs and the decline absorbs the rest, since an even
              split leaves ~124px each at 320 and the tracked label would wrap inside its own pill. */}
          <div className="flex items-center gap-3 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                answer('denied');
              }}
              className={cn(
                'inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-4 whitespace-nowrap sm:flex-none',
                // A hairline at 15% vanishes on a near-white surface; the fill is what makes it read as
                // a button at all, rather than a label sitting next to the real one.
                'border border-foreground/25 bg-background/70 text-sm font-semibold text-foreground',
                'transition-[background-color,transform] duration-150 hover:bg-foreground/5 active:scale-[0.97]',
                'focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none'
              )}
            >
              {t('consent.decline')}
            </button>

            <button
              type="button"
              {...checkHoverProps}
              onClick={() => {
                answer('granted');
              }}
              className={cn(
                'brand-gradient hover-pop inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 whitespace-nowrap sm:px-5',
                // Tracking is what makes the CTA read as brand type, but it is also ~1px per character:
                // eased off below `sm` so the longest label (es) still fits one line on a 320px screen.
                'font-display text-xs font-semibold tracking-[0.08em] text-white uppercase sm:tracking-[0.14em]',
                'active:scale-[0.97]',
                'focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none'
              )}
            >
              <CheckIcon ref={checkRef} className="size-4 shrink-0" aria-hidden="true" />
              {t('consent.accept')}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
