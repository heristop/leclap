import { useEffect } from 'react';
import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { Home, RotateCcw } from '@/presentation/components/icons';
import { Button } from '@/presentation/components/ui';
import { logger } from '@/lib/logger';

// Route-level error boundary (wired via the root route's `errorElement`). React Router renders this
// instead of its default "Unexpected Application Error!" screen whenever a route render throws.
function errorDetail(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return error.statusText.length > 0 ? error.statusText : `${error.status}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

export const RouteError = () => {
  const error = useRouteError();

  useEffect(() => {
    logger.error('Route render error', error);
  }, [error]);

  const status = isRouteErrorResponse(error) ? error.status : null;
  const detail = errorDetail(error);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-[var(--color-error)]/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative text-center max-w-md fade-in">
        <p className="text-7xl font-bold font-display brand-gradient-text mb-2">{status ?? 'Oops'}</p>
        <h1 className="text-2xl font-bold font-display text-foreground mb-2">Something went wrong</h1>
        <p className="text-gray-300 mb-2">An unexpected error interrupted this page.</p>
        <p className="mb-8 mx-auto max-w-prose break-words text-sm text-gray-500">{detail}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            onClick={() => {
              window.location.reload();
            }}
          >
            <RotateCcw /> Reload
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link to="/">
              <Home /> Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
