import { describe, expect, it } from 'vitest';
import { shelfLayout } from './projects-shelf.logic';

describe('shelfLayout', () => {
  it('shows one row, collapsed: two cards on narrow screens, four on wide ones', () => {
    const layout = shelfLayout(9, false);

    expect(layout.hiddenBelowWideFrom).toBe(2);
    expect(layout.hiddenFrom).toBe(4);
  });

  it('offers the toggle only where the collapsed row leaves cards out', () => {
    expect(shelfLayout(2, false).toggle).toBe('none');
    expect(shelfLayout(3, false).toggle).toBe('narrow');
    expect(shelfLayout(4, false).toggle).toBe('narrow');
    expect(shelfLayout(5, false).toggle).toBe('always');
  });

  it('hides nothing once expanded, and keeps the toggle to collapse again', () => {
    const layout = shelfLayout(9, true);

    expect(layout.hiddenBelowWideFrom).toBe(9);
    expect(layout.hiddenFrom).toBe(9);
    expect(layout.toggle).toBe('always');
  });
});
