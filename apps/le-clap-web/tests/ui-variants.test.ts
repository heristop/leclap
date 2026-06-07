import { describe, it, expect } from 'vitest'
import { buttonVariants, badgeVariants, cardVariants, headingVariants } from '../src/presentation/components/ui/variants'

describe('design-system variants', () => {
  it('primary button uses the brand gradient', () => {
    expect(buttonVariants({ variant: 'primary', size: 'md' })).toContain('brand-gradient')
  })

  it('ghost button has no gradient', () => {
    expect(buttonVariants({ variant: 'ghost', size: 'sm' })).not.toContain('brand-gradient')
  })

  it('button sizes change padding', () => {
    expect(buttonVariants({ variant: 'primary', size: 'sm' })).not.toBe(buttonVariants({ variant: 'primary', size: 'lg' }))
  })

  it('accent badge uses the accent token with dark text for contrast', () => {
    const c = badgeVariants({ variant: 'accent' })
    expect(c).toContain('bg-accent-400')
    expect(c).toContain('text-gray-900')
  })

  it('interactive card gets the hover-pop affordance', () => {
    expect(cardVariants({ interactive: true })).toContain('hover-pop')
    expect(cardVariants({ interactive: false })).not.toContain('hover-pop')
  })

  it('animated heading uses the animated gradient text', () => {
    expect(headingVariants({ animated: true })).toContain('text-gradient-animated')
  })
})
