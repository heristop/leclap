import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// shadcn-style Button: Radix Slot for `asChild`, cva for variants, on-brand via
// the existing OKLCH design tokens (lavender `brand-gradient`, `surface`, etc.).
const buttonVariants = cva(
  'tap inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 disabled:opacity-50 disabled:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'brand-gradient text-white shadow-lg shadow-brand-900/30 hover:-translate-y-0.5 hover:shadow-brand-500/40',
        secondary: 'bg-surface-2 text-foreground border border-divider hover:-translate-y-0.5',
        outline: 'border border-divider bg-transparent text-foreground hover:bg-foreground/5',
        ghost: 'text-gray-300 hover:text-foreground hover:bg-foreground/10',
        accent: 'bg-accent-400 text-gray-900 shadow-lg shadow-accent-500/20 hover:-translate-y-0.5',
        danger: 'bg-[var(--color-error)] text-white hover:-translate-y-0.5',
        link: 'text-brand-300 hover:text-brand-200 underline-offset-4 hover:underline',
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
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
