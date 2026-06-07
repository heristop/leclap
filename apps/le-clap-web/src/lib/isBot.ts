const BOT_PATTERN =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|quora|pinterest|slackbot|twitterbot|whatsapp|telegram|discord|lighthouse|prerender|headless|bingpreview|ia_archiver|duckduckbot|baiduspider|yandex|sogou|applebot|googlebot/i

/**
 * Heuristic for crawlers, link-preview fetchers, and headless automation. Used to skip
 * first-visit UI (the onboarding overlay) so search engines index the real page content,
 * and to skip service-worker registration for those agents.
 */
export function isBot(): boolean {
  if (typeof navigator === 'undefined') return true

  return navigator.webdriver || BOT_PATTERN.test(navigator.userAgent)
}
