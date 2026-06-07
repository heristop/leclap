import { useEffect } from 'react'

/**
 * Locks `<body>` scroll while the calling component is mounted, restoring the
 * previous value on unmount. Use in modal/overlay components so the page behind
 * doesn't scroll while they're open.
 */
export function useLockBodyScroll(): void {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previous
    }
  }, [])
}
