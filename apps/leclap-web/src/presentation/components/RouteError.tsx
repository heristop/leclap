import { useEffect } from 'react';
import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/presentation/components/ui';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { RotateCCWIcon } from '@/presentation/components/icons/rotate-ccw';
import { HomeIcon } from '@/presentation/components/icons/home';
import { useIconHover } from '@/presentation/components/icons/useIconHover';

// Route-level error boundary (wired via the root route's `errorElement`). React Router renders this
// instead of its default "Unexpected Application Error!" screen whenever a route render throws.
function errorDetail(error: unknown, fallback: string): string {
  if (isRouteErrorResponse(error)) {
    return error.statusText.length > 0 ? error.statusText : `${error.status}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export const RouteError = () => {
  const { t } = useTranslation();
  const error = useRouteError();
  const { ref: reloadRef, hoverProps: reloadHoverProps } = useIconHover();
  const { ref: homeRef, hoverProps: homeHoverProps } = useIconHover();

  useEffect(() => {
    logger.error('Route render error', error);
  }, [error]);

  const status = isRouteErrorResponse(error) ? error.status : null;
  const detail = errorDetail(error, t('routeError.unexpected'));
  // A 5xx is ours and a visitor can only wait or retry; a 4xx is about the request itself and a
  // reload usually won't help. Tint accordingly — alarm red for our fault, brand for theirs — rather
  // than painting every status with the same error red or the same brand gradient.
  const isServerFault = status === null || status >= 500;

  return (
    // This is the root route's errorElement, so it renders INSTEAD of RootLayout — there is no header
    // or footer around it. Hence a full `dvh` rather than the `100vh - header` the in-layout 404 uses.
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-16 text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className={cn(
            'absolute top-1/3 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full blur-[120px]',
            isServerFault ? 'bg-[var(--color-error)]/10' : 'bg-brand-500/10'
          )}
        />
      </div>

      {/* Staggered ~70ms apart so the status reads first, then what it means, then the way out.
          Frozen by the global reduced-motion reset. */}
      <div className="relative max-w-md text-center" role="alert">
        {/* Decorative: the heading states the problem. */}
        <p
          aria-hidden="true"
          className={cn(
            'animate-rise-in mb-2 pb-[0.08em] font-display text-7xl leading-tight font-bold tracking-tight',
            isServerFault ? 'text-[var(--color-error)]' : 'brand-gradient-text'
          )}
        >
          {status ?? t('routeError.fallbackStatus')}
        </p>
        <h1
          className="animate-rise-in mb-2 font-display text-2xl font-bold text-foreground"
          style={{ animationDelay: '70ms' }}
        >
          {t('routeError.heading')}
        </h1>
        <p className="animate-rise-in mb-2 text-muted-foreground" style={{ animationDelay: '140ms' }}>
          {t('routeError.message')}
        </p>
        {/* The raw message is for whoever reports the bug, not for reading — kept legible but clearly
            subordinate, and wrapped so a long stack-ish string can't blow out the card. */}
        <p
          className="animate-rise-in mx-auto mb-8 max-w-prose font-mono text-xs break-words text-muted-foreground/70"
          style={{ animationDelay: '180ms' }}
        >
          {detail}
        </p>
        <div
          className="animate-rise-in flex flex-col justify-center gap-3 sm:flex-row"
          style={{ animationDelay: '240ms' }}
        >
          <Button
            size="lg"
            onClick={() => {
              window.location.reload();
            }}
            {...reloadHoverProps}
          >
            <RotateCCWIcon ref={reloadRef} size={18} /> {t('routeError.reload')}
          </Button>
          <Button asChild variant="secondary" size="lg" {...homeHoverProps}>
            <Link to="/">
              <HomeIcon ref={homeRef} size={18} /> {t('nav.home')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
