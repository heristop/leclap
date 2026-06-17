import { describe, it, expect } from 'vitest';
import { ANIMATION_LIBRARY, findAnimationByUrl } from '../src/data/mediaCatalog';

// The animation list is enumerated dynamically (import.meta.glob over the creative-kit library),
// so dropping a new .apng there lists it with no edit. Guards against the glob silently resolving
// to nothing (wrong relative path / Vite config change).
describe('ANIMATION_LIBRARY (dynamic)', () => {
  it('enumerates the bundled .apng animations with stable served URLs', () => {
    expect(ANIMATION_LIBRARY.length).toBeGreaterThan(0);

    for (const a of ANIMATION_LIBRARY) {
      expect(a.file).toMatch(/\.apng$/);
      expect(a.url).toBe(`/assets/animations/${a.file}`);
      expect(a.label.length).toBeGreaterThan(0);
    }
  });

  it('resolves an animation back from its URL (round-trip for the picker)', () => {
    const first = ANIMATION_LIBRARY[0];
    expect(findAnimationByUrl(first.url)).toEqual(first);
    expect(findAnimationByUrl('/assets/animations/does-not-exist.apng')).toBeUndefined();
  });
});
