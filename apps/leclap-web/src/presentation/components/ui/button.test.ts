import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

// The label's anaglyph ghost is deliberately confined to `primary`: the design tokens are
// theme-constant while each variant's label colour is not, so one fixed blue ghost cannot flatter a
// near-black label in the light theme or dark text on the accent yellow.
describe('button anaglyph ghost', () => {
  it('ghosts the primary label', () => {
    expect(buttonVariants({ variant: 'primary', size: 'md' })).toContain('label-ghost-3d');
  });

  it('leaves every other variant unghosted', () => {
    const others = ['secondary', 'outline', 'ghost', 'accent', 'danger', 'link'] as const;

    for (const variant of others) {
      expect(buttonVariants({ variant, size: 'md' })).not.toContain('label-ghost-3d');
    }
  });

  // Disabled swaps the fill for a flat surface and the label for muted-foreground; a leftover blue
  // fringe on that would read as a rendering fault rather than as depth.
  it('drops the ghost when the button is disabled', () => {
    expect(buttonVariants({ variant: 'primary', size: 'md' })).toContain('disabled:[text-shadow:none]');
  });

  // Icon-only buttons have no text node, so the shadow no-ops on its own — but the class must still
  // be present, since size and variant are independent axes.
  it('keeps the ghost on the icon size, where it simply has no text to paint', () => {
    expect(buttonVariants({ variant: 'primary', size: 'icon' })).toContain('label-ghost-3d');
  });

  // buttonVariants() is the pre-merge string; the DOM gets cn()'s output. A utility whose name falls
  // into one of tailwind-merge's groups (anything `text-*`, say) is silently dropped there and the
  // effect never renders, which no assertion on buttonVariants() can see.
  it('survives the tailwind-merge pass that produces the real className', () => {
    expect(cn(buttonVariants({ variant: 'primary', size: 'md' }))).toContain('label-ghost-3d');
  });
});
