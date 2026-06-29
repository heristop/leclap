import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { usePointerGlow } from '@/hooks/usePointerGlow';

const cardVariants = cva('bg-surface border border-divider rounded-2xl', {
  variants: {
    elevation: {
      flat: '',
      raised: 'shadow-[var(--shadow-md)]',
      floating: 'shadow-[var(--shadow-lg)]',
    },
    interactive: {
      true: 'cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]',
      false: '',
    },
  },
  defaultVariants: { elevation: 'raised', interactive: false },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  gradientBorder?: boolean;
  /** Magnetic/spotlight surface: leans toward the cursor with a pointer-tracked lavender glow. */
  glow?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, interactive, gradientBorder, glow, ...props }, ref) => {
    // glow opts the surface into the magnetic/spotlight motion language (usePointerGlow + utilities).
    const { ref: glowRef, glowProps } = usePointerGlow<HTMLDivElement>();

    // When glow is on, the pointer hook owns the element ref; fan it out to the forwarded ref too.
    const setRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        if (glow) {
          glowRef.current = node;
        }

        if (typeof ref === 'function') {
          ref(node);

          return;
        }

        if (ref) {
          ref.current = node;
        }
      },
      [glow, glowRef, ref]
    );

    return (
      <div
        ref={setRef}
        className={cn(
          // glow's tilt owns the transform, so it can't coexist with interactive's hover-lift —
          // swap that lift for a non-transform cursor + glow-shadow when both are set.
          cardVariants({ elevation, interactive: glow ? false : interactive }),
          gradientBorder && 'gradient-border',
          glow && 'spotlight pointer-tilt',
          glow && interactive && 'cursor-pointer transition-shadow duration-300 hover:shadow-[var(--shadow-glow)]',
          className
        )}
        {...(glow ? glowProps : {})}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 p-6 pb-3', className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-xl font-bold font-display text-foreground', className)} {...props} />
);

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-gray-400', className)} {...props} />
);

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-6 pt-0', className)} {...props} />
);

const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center gap-2 p-6 pt-0', className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
