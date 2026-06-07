import { useEffect, useRef, useState, type RefObject } from 'react'

interface UseInViewOptions {
  /** Fraction of the element visible before it counts as in-view (0..1). */
  threshold?: number
  /** Reveal once then stop observing (default true). */
  once?: boolean
  /** Margin around the root; the default reveals slightly before the element is fully on screen. */
  rootMargin?: string
}

/**
 * Observe an element and report when it scrolls into the viewport, via IntersectionObserver.
 * Falls back to immediately in-view when IntersectionObserver is unavailable.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.15,
  once = true,
  rootMargin = '0px 0px -10% 0px',
}: UseInViewOptions = {}): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current

    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)

      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true)

            if (once) observer.unobserve(entry.target)
          } else if (!once) {
            setInView(false)
          }
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)

    return () => { observer.disconnect() }
  }, [threshold, once, rootMargin])

  return [ref, inView]
}
