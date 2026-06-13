// Alpha-apparition wrapper. On mount, its children fade in (opacity 0 → 1 with a tiny upward
// translate) using transform+opacity only — never layout properties. `index` staggers siblings so a
// freshly-revealed group of controls cascades in instead of snapping. The first paint renders the
// hidden state, then a layout-effect flips to the shown state on the next frame so the transition runs.
// prefers-reduced-motion users get the shown state immediately (the motion-reduce utilities below
// force opacity/translate to their resting values and zero the transition).
import { useLayoutEffect, useState, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface FadeInProps extends HTMLAttributes<HTMLDivElement> {
  /** Stagger position; each step adds ~36ms of delay so a revealed group cascades. */
  index?: number;
}

const STAGGER_MS = 36;

export const FadeIn = ({ index = 0, className, style, children, ...props }: FadeInProps) => {
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      setShown(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className={cn(
        'transition-[opacity,transform] duration-200 ease-[var(--ease-out-expo)] will-change-[opacity,transform]',
        'motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        className
      )}
      style={{ transitionDelay: shown ? `${index * STAGGER_MS}ms` : '0ms', ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
