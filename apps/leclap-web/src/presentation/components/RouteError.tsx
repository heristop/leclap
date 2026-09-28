import { useEffect, useState } from 'react';
import { Link, isRouteErrorResponse, useHref, useLocation, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import { useOnline } from '@/hooks/use-online';
import { LogoMark } from '@/presentation/components/LogoMark';
import { Seo } from '@/presentation/components/Seo';
import {
  NotFoundScene,
  ProblemScene,
  isChunkLoadError,
  routeErrorKind,
  suggestPath,
} from '@/presentation/components/error-scene';

// Route-level error boundary (wired via the root route's `errorElement`). React Router renders this instead
// of its default "Unexpected Application Error!" screen whenever a route fails: its code failed to download,
// it threw while rendering, or it threw a route response (a 404, a 400). It renders INSTEAD of RootLayout —
// no header, no footer — so it brings its own brand bar, and it fills the viewport itself.
export const RouteError = () => {
  const { t } = useTranslation();
  const error = useRouteError();
  const online = useOnline();
  // Taken when the error happened: a page that failed to download offline stays a connection problem once the
  // connection is back, rather than turning into "a new version is out".
  const [offlineAtError] = useState(() => !online);
  const { pathname } = useLocation();
  const shown = useHref(pathname);
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const kind = routeErrorKind({ status, chunk: isChunkLoadError(error), online: !offlineAtError });

  useEffect(() => {
    logger.error('Route render error', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Seo title={t(`routeError.seoTitle.${kind}`)} noindex />
      <BrandBar />
      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        {kind === 'notFound' ? (
          <NotFoundScene path={shown} suggestion={suggestPath(pathname)} reloadDocument />
        ) : (
          <ProblemScene kind={kind} error={error} status={status} online={online} path={shown} />
        )}
      </main>
    </div>
  );
};

/** The header's logo and name, home by a full page load: the app itself may be what broke. */
const BrandBar = () => {
  const { t } = useTranslation();

  return (
    <header className="px-5 py-4 sm:px-8">
      <Link
        to="/"
        reloadDocument
        className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
      >
        <LogoMark className="size-10 [filter:drop-shadow(0_6px_14px_rgba(91,97,214,0.35))]" />
        <span className="text-xl font-bold tracking-tight text-foreground">{t('brand')}</span>
      </Link>
    </header>
  );
};
