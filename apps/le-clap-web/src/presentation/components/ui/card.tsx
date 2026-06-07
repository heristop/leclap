import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

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
})

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  gradientBorder?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, interactive, gradientBorder, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ elevation, interactive }), gradientBorder && 'gradient-border', className)} {...props} />
  )
)
Card.displayName = 'Card'

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 p-6 pb-3', className)} {...props} />
)

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-xl font-bold font-display text-foreground', className)} {...props} />
)

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-gray-400', className)} {...props} />
)

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-6 pt-0', className)} {...props} />
)

const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center gap-2 p-6 pt-0', className)} {...props} />
)

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants }
