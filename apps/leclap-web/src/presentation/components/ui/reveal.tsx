import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useInView } from '@/hooks/useInView';

export interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  /** Stagger delay in ms applied when the element enters the viewport. */
  delay?: number;
  /** Entrance direction (default 'up'). */
  from?: 'up' | 'down' | 'left' | 'right' | 'none';
  /** Add a subtle scale-up to the entrance (0.96 → 1), for cards that should "settle" into place. */
  scale?: boolean;
  /** Override the in-view trigger; both fall back to the useInView defaults when omitted. */
  threshold?: number;
  rootMargin?: string;
}

const HIDDEN = {
  up: 'opacity-0 translate-y-6',
  down: 'opacity-0 -translate-y-6',
  left: 'opacity-0 -translate-x-6',
  right: 'opacity-0 translate-x-6',
  none: 'opacity-0',
} as const;

/**
 * Scroll-reveal wrapper: fades/rises its children in when they enter the viewport
 * (IntersectionObserver via {@link useInView}). Reduced-motion users see content immediately.
 */
export const Reveal = ({
  className,
  delay = 0,
  from = 'up',
  scale = false,
  threshold,
  rootMargin,
  style,
  children,
  ...props
}: RevealProps) => {
  const [ref, inView] = useInView({ threshold, rootMargin });

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-[var(--ease-spring)]',
        'motion-reduce:transition-none motion-reduce:!translate-x-0 motion-reduce:!translate-y-0 motion-reduce:!scale-100 motion-reduce:!opacity-100',
        // will-change only while hidden so the entrance is hinted; once revealed the element is
        // static, so we drop the hint and free its compositor layer (avoids scroll jank when many
        // Reveals are on a page).
        inView
          ? cn('translate-x-0 translate-y-0 opacity-100', scale && 'scale-100')
          : cn(HIDDEN[from], scale && 'scale-[0.96]', 'will-change-[transform,opacity]'),
        className
      )}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms', ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
