import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useInView } from '@/hooks/useInView';

export interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  /** Stagger delay in ms applied when the element enters the viewport. */
  delay?: number;
  /** Entrance direction (default 'up'). */
  from?: 'up' | 'down' | 'none';
  /** Override the in-view trigger; both fall back to the useInView defaults when omitted. */
  threshold?: number;
  rootMargin?: string;
}

const HIDDEN = {
  up: 'opacity-0 translate-y-6',
  down: 'opacity-0 -translate-y-6',
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
        'motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100',
        // will-change only while hidden so the entrance is hinted; once revealed the element is
        // static, so we drop the hint and free its compositor layer (avoids scroll jank when many
        // Reveals are on a page).
        inView ? 'opacity-100 translate-y-0' : cn(HIDDEN[from], 'will-change-[transform,opacity]'),
        className
      )}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms', ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
