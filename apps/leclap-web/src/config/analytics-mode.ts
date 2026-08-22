// Which tracker the site runs, decided from the env alone — the app's half of that answer.
//
// The build decides the same thing over the same env keys, in vite.config.ts, because the project
// reference between tsconfig.json and tsconfig.node.json keeps app source and the config in separate
// projects and a file may not be in both. analytics-mode.test.ts reads the config as text and holds
// the two together, the way site.test.ts does for index.html.
//
// Pure functions only: no runtime imports, no DOM.

export type AnalyticsMode = 'umami' | 'ga' | 'none';

export interface UmamiConfig {
  scriptSrc: string;
  websiteId: string;
  /** Only when the collect API answers on another origin than the script. */
  hostUrl?: string;
}

/** The subset of the env this file reads. Vite exposes the same keys to both callers. */
export interface AnalyticsEnv {
  VITE_UMAMI_SRC?: string;
  VITE_UMAMI_WEBSITE_ID?: string;
  VITE_UMAMI_HOST_URL?: string;
}

/** The block in index.html the build swaps for the configured tracker's tag. */
export const ANALYTICS_BLOCK = /<!-- analytics:start -->[\s\S]*?<!-- analytics:end -->/;

/** The id the build gives the Umami tag, and the hook lib/umami.ts waits on. */
export const UMAMI_TAG_ID = 'umami-tag';

/** The env keys both halves read. Named once so the drift guard can check the config for them. */
export const UMAMI_ENV_KEYS = ['VITE_UMAMI_SRC', 'VITE_UMAMI_WEBSITE_ID', 'VITE_UMAMI_HOST_URL'] as const;

const text = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

/** Undefined unless both halves are set: neither one alone can send a hit. */
export const umamiConfig = (env: AnalyticsEnv): UmamiConfig | undefined => {
  const scriptSrc = text(env.VITE_UMAMI_SRC);
  const websiteId = text(env.VITE_UMAMI_WEBSITE_ID);

  if (!scriptSrc || !websiteId) {
    return undefined;
  }

  return { scriptSrc, websiteId, hostUrl: text(env.VITE_UMAMI_HOST_URL) };
};

/**
 * Umami wins over GA when both are configured, so a half-finished migration measures once rather
 * than twice.
 */
export const analyticsMode = (env: AnalyticsEnv, gaMeasurementId: string): AnalyticsMode => {
  if (umamiConfig(env)) {
    return 'umami';
  }

  return text(gaMeasurementId) ? 'ga' : 'none';
};

/**
 * Only Google Analytics asks. Umami sets no cookie and writes no identifier on the visitor's device
 * — which is what the bar asks about — and `none` puts no tag on the page at all, so in both cases
 * the bar would be a question about nothing. (Umami still derives a pseudonymous visitor hash
 * server-side: cookieless is not the same claim as anonymous.)
 *
 * `none` only holds because the build takes the authored GA block out when the property is cleared;
 * see the plugin in vite.config.ts. Without that, clearing the id would hide the bar while the
 * snippet kept loading gtag.js for anyone with a stored yes.
 */
export const consentRequired = (mode: AnalyticsMode): boolean => mode === 'ga';
