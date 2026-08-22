// Umami side of the analytics module. The tag itself is in index.html (the build puts it there when
// the env configures one), so nothing here fetches anything: this only reports page views to a
// tracker that is already on the page, or holds them until it arrives.

import { UMAMI_TAG_ID } from '@/config/analytics-mode';

type UmamiProps = Record<string, unknown>;

interface UmamiTracker {
  track(payload?: UmamiProps | ((props: UmamiProps) => UmamiProps)): void;
  track(name: string, data?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

/**
 * The tag is async, so the landing page view is queued more often than not. The cap only matters
 * when the script never arrives — a blocked host, an instance that is down — where an unbounded
 * queue would grow for the whole session.
 */
export const MAX_QUEUED = 20;

type QueuedCall = (tracker: UmamiTracker) => void;

/** Keeps the newest calls once full: a view from ten navigations ago is the one worth losing. */
export const enqueue = <T>(queue: T[], call: T, max: number): T[] =>
  queue.length >= max ? [...queue.slice(queue.length - max + 1), call] : [...queue, call];

/**
 * The override Umami sends for one page view. The callback form is what keeps the website id the
 * tag injected — a bare object would drop it and the hit would be rejected.
 */
export const pageViewProps =
  (url: string, title: string) =>
  (props: UmamiProps): UmamiProps => ({ ...props, url, title });

let queue: QueuedCall[] = [];
let bound = false;

/** Flushes what was queued once the tag loads, and drops it if the tag never does. */
const bindTag = (): void => {
  if (bound) {
    return;
  }

  const tag = document.getElementById(UMAMI_TAG_ID);

  if (!tag) {
    return;
  }

  bound = true;

  tag.addEventListener(
    'load',
    () => {
      const pending = queue;

      queue = [];

      const tracker = window.umami;

      if (!tracker) {
        return;
      }

      for (const call of pending) {
        call(tracker);
      }
    },
    { once: true }
  );

  // An ad blocker, or an unreachable instance: drop what was buffered rather than hold navigations
  // for a tracker that is never coming.
  tag.addEventListener(
    'error',
    () => {
      queue = [];
    },
    { once: true }
  );
};

const send = (call: QueuedCall): void => {
  const tracker = window.umami;

  if (tracker) {
    call(tracker);

    return;
  }

  bindTag();
  queue = enqueue(queue, call, MAX_QUEUED);
};

/** Report the page the visitor is on. Called only once the shared consent gate has allowed it. */
export function trackUmamiPageView(): void {
  const props = pageViewProps(window.location.pathname + window.location.search, document.title);

  send((tracker) => {
    tracker.track(props);
  });
}
