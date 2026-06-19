import { flushSync } from 'react-dom';

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Run a React state update inside a View Transition so the browser morphs elements that share a
// `view-transition-name` across the change — e.g. the picked template's title growing into the studio
// titlebar. The state change must be applied synchronously (flushSync) so the new DOM exists when the
// browser captures the "after" snapshot. Falls back to a plain update where the API is missing or the
// user prefers reduced motion, so behaviour is identical everywhere except the animation.
export function withViewTransition(update: () => void): void {
  if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    update();

    return;
  }

  document.startViewTransition(() => {
    flushSync(update);
  });
}
