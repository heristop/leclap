import { describe, expect, it } from 'vitest';
import { navigationItems, visibleNavItems } from './header-nav.logic';

const hrefs = (items: readonly { href: string }[]) => items.map((item) => item.href);

describe('visibleNavItems', () => {
  it('hides Projects while this browser has no saved project', () => {
    expect(hrefs(visibleNavItems(false))).not.toContain('/projects');
  });

  it('shows Projects once one exists', () => {
    expect(hrefs(visibleNavItems(true))).toContain('/projects');
  });

  it('leaves every other entry in place, in order', () => {
    expect(hrefs(visibleNavItems(true))).toEqual(hrefs(navigationItems));
    expect(hrefs(visibleNavItems(false))).toEqual(hrefs(navigationItems).filter((href) => href !== '/projects'));
  });
});
