import { describe, expect, it } from 'vitest';
import { isNavActive } from './header-nav.logic';

describe('isNavActive', () => {
  it('lights an entry on its own page and on every page below it', () => {
    expect(isNavActive('/doc', '/doc')).toBe(true);
    expect(isNavActive('/doc/cli', '/doc')).toBe(true);
    expect(isNavActive('/studio/new', '/studio')).toBe(true);
  });

  it('does not confuse a page with another that merely shares its first letters', () => {
    expect(isNavActive('/docs-archive', '/doc')).toBe(false);
    expect(isNavActive('/templates', '/doc')).toBe(false);
  });

  it('lights Home on the home page only', () => {
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/about', '/')).toBe(false);
  });
});
