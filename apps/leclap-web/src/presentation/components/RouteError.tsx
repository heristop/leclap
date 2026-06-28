import { useEffect } from 'react';
import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/presentation/components/ui';
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

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-[var(--color-error)]/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative text-center max-w-md fade-in">
        <p className="mb-2 pb-[0.08em] font-display text-7xl font-bold leading-tight brand-gradient-text">
          {status ?? t('routeError.fallbackStatus')}
        </p>
        <h1 className="text-2xl font-bold font-display text-foreground mb-2">{t('routeError.heading')}</h1>
        <p className="text-gray-300 mb-2">{t('routeError.message')}</p>
        <p className="mb-8 mx-auto max-w-prose break-words text-sm text-gray-500">{detail}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
