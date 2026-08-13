import { describe, expect, it } from 'vitest';
import { localePath } from './language';

// Prefix arithmetic for the locale-prefixed URL scheme (English at the root, /fr, /de, … beside it).
// Both the language picker and LanguageSuggestion build their targets with it, so the swap/strip/add
// cases below are the contract those two depend on.
describe('localePath', () => {
  it('adds a prefix for a non-English target', () => {
    expect(localePath('de', '/studio')).toBe('/de/studio');
  });

  it('swaps an existing prefix', () => {
    expect(localePath('de', '/fr/studio')).toBe('/de/studio');
  });

  it('drops the prefix for English', () => {
    expect(localePath('en', '/fr/studio')).toBe('/studio');
  });

  it('keeps the root bare in English', () => {
    expect(localePath('en', '/fr')).toBe('/');
  });

  it('does not leave a trailing slash on a prefixed root', () => {
    expect(localePath('it', '/')).toBe('/it');
  });
});
