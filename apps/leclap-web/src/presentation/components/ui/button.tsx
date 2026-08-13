import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn-style Button: Radix Slot for `asChild`, cva for variants, on-brand via
// the existing OKLCH design tokens (lavender `brand-gradient`, `surface`, etc.).
// Disabled treatment for the filled variants. Opacity alone doesn't carry it: a brand gradient at
// 50% still reads as a live button, so the fill and shadow drop out entirely and the button settles
// on a flat surface, where colour, elevation and cursor agree. `[background-image:none]` is
// long-hand on purpose — `bg-none` and `bg-surface-2` collide in tailwind-merge, which keeps only
// one and leaves the gradient painted.
const DISABLED_FILL =
  'disabled:[background-image:none] disabled:bg-surface-2 disabled:text-muted-foreground disabled:shadow-none disabled:ring-1 disabled:ring-foreground/10';

const buttonVariants = cva(
  'tap inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 disabled:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: `brand-gradient text-ghost-3d text-white shadow-lg shadow-brand-900/30 hover:-translate-y-0.5 hover:shadow-brand-500/40 disabled:[text-shadow:none] ${DISABLED_FILL}`,
        secondary: 'bg-surface-2 text-foreground border border-divider hover:-translate-y-0.5 disabled:opacity-50',
        outline: 'border border-divider bg-transparent text-foreground hover:bg-foreground/5 disabled:opacity-50',
        ghost: 'text-gray-300 hover:text-foreground hover:bg-foreground/10 disabled:opacity-50',
        accent: `bg-accent-400 text-gray-900 shadow-lg shadow-accent-500/20 hover:-translate-y-0.5 ${DISABLED_FILL}`,
        danger: `bg-[var(--color-error)] text-white hover:-translate-y-0.5 ${DISABLED_FILL}`,
        link: 'text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'text-sm px-3 py-1.5',
        md: 'px-5 py-2.5',
        lg: 'text-lg px-7 py-3.5',
        icon: 'p-2.5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
