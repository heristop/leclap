import { useEffect, useRef, useState, type RefObject } from 'react';

interface UseInViewOptions {
  /** Fraction of the element visible before it counts as in-view (0..1). */
  threshold?: number;
  /** Reveal once then stop observing (default true). */
  once?: boolean;
  /** Margin around the root; the default reveals slightly before the element is fully on screen. */
  rootMargin?: string;
}

/**
 * Observe an element and report when it scrolls into the viewport, via IntersectionObserver.
 * Falls back to immediately in-view when IntersectionObserver is unavailable.
 */
export function useInView<T extends Element = HTMLDivElement>({
  threshold = 0.1,
  once = true,
  // Positive bottom margin grows the observer root downward, so an element reveals a bit before it
  // reaches the fold (snappier on scroll-down). Keep the bottom margin positive — a negative one
  // would hide page-bottom elements that can't scroll any higher.
  rootMargin = '0px 0px 15% 0px',
}: UseInViewOptions = {}): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;

    if (!el) return () => {};

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);

      return () => {};
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);

            if (once) observer.unobserve(entry.target);
            continue;
          }

          if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [threshold, once, rootMargin]);

  return [ref, inView];
}
