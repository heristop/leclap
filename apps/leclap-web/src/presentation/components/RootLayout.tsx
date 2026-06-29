import { Suspense, lazy, useEffect } from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { haptic } from '@/lib/haptics';
import { Header } from '@/presentation/components/Header';
import { Footer } from '@/presentation/components/Footer';
import { useOnboarding } from '@/hooks/useOnboarding';

// Onboarding pulls in the compile pipeline (and FFmpeg WASM); it only shows on first visit, so lazy-
// loading it keeps that weight out of the entry chunk and off the landing page's critical path.
const Onboarding = lazy(() =>
  import('@/presentation/components/Onboarding').then((module) => ({ default: module.Onboarding }))
);

// The shared chrome (skip link, header, footer, onboarding) wraps every route via <Outlet />.
// <ScrollRestoration /> gives native scroll behavior: top on forward navigations, restored position
// on back/forward — the browser default that client-side routing otherwise loses.
export function RootLayout() {
  const { t } = useTranslation();
  const { show, dismiss } = useOnboarding();

  // App-wide tactile feedback: a subtle haptic on every press of an interactive
  // element gives the web app a native, responsive feel (web-haptics).
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const el = event.target as Element | null;

      if (el?.closest('button, a, [role="button"], input[type="range"], .tap')) {
        haptic('selection');
      }
    };
    document.addEventListener('pointerdown', onPointerDown, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return (
    <>
      <ScrollRestoration />
      <div className="flex min-h-screen flex-col bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-600 focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/80"
        >
          {t('skipToContent')}
        </a>
        <Header />

        {/* tabIndex={-1} so the skip link can move keyboard focus here, not just scroll — without it
            focus stays on the link and the next Tab falls back into the header nav. */}
        <main id="main-content" tabIndex={-1} className="outline-none">
          {/* Lazy routes resolve under this boundary; null fallback avoids a flash on fast chunk loads. */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>

        <Footer />
      </div>

      {/* First-visit guided intro (record → compile a sample → download). */}
      {show && (
        <Suspense fallback={null}>
          <Onboarding onDone={dismiss} />
        </Suspense>
      )}
    </>
  );
}
