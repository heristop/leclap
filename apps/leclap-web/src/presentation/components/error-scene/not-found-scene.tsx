import { Link, useHref } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/presentation/components/ui';
import { ArrowRight } from '@/presentation/components/icons';
import { HomeIcon } from '@/presentation/components/icons/home';
import { CompassIcon } from '@/presentation/components/icons/compass';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { ErrorScene, PathSentence, SceneActions, SceneMessage } from './error-scene';
import { statusTimecode } from './route-error.logic';

// Where else a lost visitor may have been heading: the header's own destinations, less the two buttons'.
const ELSEWHERE = [
  { labelKey: 'nav.templates', href: '/templates' },
  { labelKey: 'nav.docs', href: '/doc' },
  { labelKey: 'nav.about', href: '/about' },
] as const;

export interface NotFoundSceneProps {
  /** The address that led nowhere, as the visitor sees it in the address bar. */
  path: string;
  /** The page it most likely meant (not-found.logic.ts: suggestPath), or null. */
  suggestion: string | null;
  /** Leave with full page loads: set on the error page, where the app itself may be what broke. */
  reloadDocument?: boolean;
}

/**
 * The 404: Clappy searches the frame and shrugs, the heading owns up in the films' vocabulary, and the page
 * points somewhere useful — the address that failed (a typo is easier to spot on the page), the page it most
 * likely meant, home and the studio, and the rest of the site.
 */
export const NotFoundScene = ({ path, suggestion, reloadDocument = false }: NotFoundSceneProps) => {
  const { t } = useTranslation('shell');
  const { t: tCommon } = useTranslation();
  // The hover props go on the Button, not the icon: the whole control is the hit target.
  const { ref: homeRef, hoverProps: homeHoverProps } = useIconHover();
  const { ref: studioRef, hoverProps: studioHoverProps } = useIconHover();

  return (
    <ErrorScene
      reaction="search"
      slate={t('notFound.slate')}
      tone="brand"
      timecode={statusTimecode(404)}
      eyebrow={t('notFound.eyebrow')}
      title={t('notFound.title')}
    >
      <SceneMessage>
        <PathSentence sentence={t('notFound.message')} path={path} />
      </SceneMessage>

      {suggestion !== null && <Suggestion to={suggestion} reloadDocument={reloadDocument} />}

      <SceneActions>
        <Button asChild size="lg" {...homeHoverProps}>
          <Link to="/" reloadDocument={reloadDocument}>
            <HomeIcon ref={homeRef} size={16} /> {t('notFound.home')}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" {...studioHoverProps}>
          <Link to="/studio" reloadDocument={reloadDocument}>
            <CompassIcon ref={studioRef} size={16} /> {t('notFound.studio')}
          </Link>
        </Button>
      </SceneActions>

      <nav
        aria-label={t('notFound.elsewhere')}
        className="mt-10 flex flex-col items-center gap-1 sm:flex-row sm:justify-center sm:gap-4"
      >
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
          {t('notFound.elsewhere')}
        </span>
        <ul className="flex items-center gap-4 text-sm font-medium">
          {ELSEWHERE.map(({ labelKey, href }) => (
            <li key={href}>
              <Link
                to={href}
                reloadDocument={reloadDocument}
                className="inline-flex min-h-11 items-center rounded-sm px-1 text-foreground/80 underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground hover:decoration-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
              >
                {tCommon(labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </ErrorScene>
  );
};

/** "Did you mean …?": the likeliest page, as one obvious card above the buttons. */
const Suggestion = ({ to, reloadDocument }: { to: string; reloadDocument: boolean }) => {
  const { t } = useTranslation('shell');
  // The address bar's form of it, locale prefix included, to read against the one that failed.
  const shown = useHref(to);

  return (
    <Link
      to={to}
      reloadDocument={reloadDocument}
      className="group mx-auto mt-6 flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-brand-500/50 hover:bg-brand-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
    >
      <span className="min-w-0">
        <PathSentence sentence={t('notFound.suggestion')} path={shown} />
      </span>
      <ArrowRight
        aria-hidden="true"
        className="size-4 shrink-0 text-brand-700 transition-transform group-hover:translate-x-0.5 dark:text-brand-300"
      />
    </Link>
  );
};
