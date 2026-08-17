import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';

/**
 * One page_view per route reached, the first included — `send_page_view` is off on the config because
 * gtag.js only ever sees the landing URL of a client-side router. Keyed on the router's location so a
 * `replace` counts too; the path sent comes from the live URL, prefix included. No-op without consent.
 */
export function usePageViews(): void {
  const { pathname, search } = useLocation();

  useEffect(() => {
    trackPageView();
  }, [pathname, search]);
}
