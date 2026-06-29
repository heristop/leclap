// A segmented toggle with a single thumb that glides between options — the "magnetic" pill used across
// the app (template filters, doc CLI tabs, media-source switch). The thumb is measured from the active
// button and animated via transform + width with a slight overshoot for the magnetic feel; a
// ResizeObserver keeps it aligned through layout changes and reduced-motion snaps instead of sliding.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Track padding (px): the thumb sits inside it, so the measured offset is shifted by this much.
const TRACK_PAD = 2;

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  // For icon-only labels: the accessible name + hover tooltip (the visible label carries no text).
  ariaLabel?: string;
}

export interface SegmentedControlProps {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  // Style slots so a caller can re-skin the pill (e.g. the dark docs variant) without forking the logic.
  classNames?: {
    track?: string;
    thumb?: string;
    button?: string;
    active?: string;
    inactive?: string;
  };
}

export const SegmentedControl = ({ value, options, onChange, ariaLabel, classNames }: SegmentedControlProps) => {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  useLayoutEffect(() => {
    const measure = () => {
      const el = buttonsRef.current[activeIndex];

      if (!el) return;

      const next = { left: el.offsetLeft, width: el.offsetWidth };
      setThumb((prev) => (prev && prev.left === next.left && prev.width === next.width ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);

    for (const el of buttonsRef.current) {
      if (el) observer.observe(el);
    }

    return () => {
      observer.disconnect();
    };
  }, [activeIndex, options]);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex max-w-full overflow-x-auto rounded-lg bg-foreground/5 p-0.5 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        classNames?.track
      )}
    >
      {thumb && (
        <span
          aria-hidden
          className={cn(
            'absolute bottom-0.5 left-0 top-0.5 rounded-md bg-surface shadow-sm transition-[transform,width] duration-300 [transition-timing-function:cubic-bezier(0.34,1.55,0.64,1)] motion-reduce:transition-none',
            classNames?.thumb
          )}
          style={{ transform: `translateX(${thumb.left - TRACK_PAD}px)`, width: thumb.width }}
        />
      )}
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(el) => {
            buttonsRef.current[index] = el;
          }}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          aria-label={option.ariaLabel}
          title={option.ariaLabel}
          onClick={() => {
            onChange(option.value);
          }}
          className={cn(
            'tap relative z-10 shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors',
            value === option.value
              ? cn('text-foreground', classNames?.active)
              : cn('text-gray-400 hover:text-foreground', classNames?.inactive),
            classNames?.button
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
