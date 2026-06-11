import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useInView } from '@/hooks/useInView';

export interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  /** Stagger delay in ms applied when the element enters the viewport. */
  delay?: number;
  /** Entrance direction (default 'up'). */
  from?: 'up' | 'down' | 'none';
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
export const Reveal = ({ className, delay = 0, from = 'up', style, children, ...props }: RevealProps) => {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-[var(--ease-spring)] will-change-[transform,opacity]',
        'motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100',
        inView ? 'opacity-100 translate-y-0' : HIDDEN[from],
        className
      )}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms', ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
