import { logger } from '@/lib/logger';

export type TickerCallback = (time: number) => void;

// One requestAnimationFrame loop for the whole marketing surface. Every scroll-driven effect on the
// landing page — hero parallax, the playhead paint, the film scrub — reads the same frame instead of
// scheduling its own, so they can never disagree about where the page is or tear against each other.
// The loop exists only while something is subscribed: the last unsubscribe cancels it outright, so an
// idle page costs nothing.
const subscribers = new Set<TickerCallback>();
let frameId = 0;
let running = false;

function schedule(): void {
  if (running || subscribers.size === 0) return;

  // Property access, not a captured reference: rAF needs its receiver, and a bare call throws
  // "Illegal invocation" in Chrome. Absent entirely during SSR/prerender, where we simply stay idle.
  if (typeof globalThis.requestAnimationFrame !== 'function') return;

  running = true;
  frameId = globalThis.requestAnimationFrame(frame);
}

function stop(): void {
  if (!running) return;

  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(frameId);
  }

  running = false;
  frameId = 0;
}

function frame(time: number): void {
  running = false;

  // Snapshot the set: a callback is free to subscribe or unsubscribe mid-frame without changing who
  // runs in this pass.
  const due = [...subscribers];

  for (const callback of due) {
    runSubscriber(callback, time);
  }

  schedule();
}

// A subscriber that throws is evicted rather than allowed to break every other effect on the page —
// one bad callback must not take the whole page's motion down with it.
function runSubscriber(callback: TickerCallback, time: number): void {
  try {
    callback(time);
  } catch (error) {
    subscribers.delete(callback);
    logger.error('[ticker] subscriber threw and was removed', error);
  }
}

/**
 * Register a per-frame callback. Returns the unsubscribe function; call it on cleanup.
 * The callback receives the frame's `DOMHighResTimeStamp` (what Lenis and any time-based easing need).
 */
export function subscribe(callback: TickerCallback): () => void {
  subscribers.add(callback);
  schedule();

  return () => {
    subscribers.delete(callback);

    if (subscribers.size === 0) stop();
  };
}
