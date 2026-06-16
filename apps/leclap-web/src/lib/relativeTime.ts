export type RelativeTimeKey = 'justNow' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export interface RelativeTime {
  key: RelativeTimeKey;
  count: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Pure, i18n-friendly relative time: returns a translation key + count so the caller formats it
// (`t(`time.${key}`, { count })`). Coarse on purpose — drafts only need "2h ago" granularity.
export function relativeTime(timestamp: number, now: number): RelativeTime {
  const elapsed = Math.max(0, now - timestamp);

  if (elapsed < MIN) return { key: 'justNow', count: 0 };

  if (elapsed < HOUR) return { key: 'minutes', count: Math.floor(elapsed / MIN) };

  if (elapsed < DAY) return { key: 'hours', count: Math.floor(elapsed / HOUR) };

  if (elapsed < 7 * DAY) return { key: 'days', count: Math.floor(elapsed / DAY) };

  if (elapsed < 30 * DAY) return { key: 'weeks', count: Math.floor(elapsed / (7 * DAY)) };

  return { key: 'months', count: Math.floor(elapsed / (30 * DAY)) };
}
