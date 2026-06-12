import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
  {
    variants: {
      variant: {
        brand: 'bg-brand-500/15 text-brand-700 border border-brand-500/30 dark:bg-brand-500/20 dark:text-brand-200',
        secondary: 'bg-secondary-500/15 text-secondary-700 border border-secondary-500/25 dark:text-secondary-300',
        accent: 'bg-accent-400 text-gray-900',
        neutral: 'bg-foreground/10 text-gray-300 border border-divider',
        success: 'bg-success/15 text-success-foreground border border-success/30',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
