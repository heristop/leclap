import { describe, it, expect } from 'vitest';
import { watermarkToAnimation, hasWholeVideoOverlays } from '@/editor/presets/watermark';
import type { Watermark } from '@/core/types';

const BASE: Watermark = { url: 'pictures/logo.png' };

describe('watermarkToAnimation', () => {
  it('lowers the bottom-right corner (default position) with the default margin', () => {
    const anim = watermarkToAnimation(BASE, '1280:720');

    expect(anim.position).toBe('W-w-24:H-h-24');
  });

  it('lowers the top-left corner', () => {
    const anim = watermarkToAnimation({ ...BASE, position: 'top-left' }, '1280:720');

    expect(anim.position).toBe('24:24');
  });

  it('lowers the top-right corner', () => {
    const anim = watermarkToAnimation({ ...BASE, position: 'top-right' }, '1280:720');

    expect(anim.position).toBe('W-w-24:24');
  });

  it('lowers the bottom-left corner', () => {
    const anim = watermarkToAnimation({ ...BASE, position: 'bottom-left' }, '1280:720');

    expect(anim.position).toBe('24:H-h-24');
  });

  it('lowers the bottom-right corner explicitly (same as the default)', () => {
    const anim = watermarkToAnimation({ ...BASE, position: 'bottom-right' }, '1280:720');

    expect(anim.position).toBe('W-w-24:H-h-24');
  });

  it('applies every default when only url is given: scale 0.12, opacity 0.8, margin 24, bottom-right', () => {
    const anim = watermarkToAnimation(BASE, '1280:720');

    expect(anim.url).toBe('pictures/logo.png');
    expect(anim.position).toBe('W-w-24:H-h-24');
    // 1280 * 0.12 = 153.6 -> rounds to 154
    expect(anim.scale).toBe('154:-1');
    expect(anim.opacity).toBe(0.8);
  });

  it('resolves the default scale fraction against a 1280x720 (landscape) output', () => {
    const anim = watermarkToAnimation(BASE, '1280:720');

    expect(anim.scale).toBe('154:-1');
  });

  it('resolves the default scale fraction against a 720x1280 (portrait) output using its own WIDTH', () => {
    const anim = watermarkToAnimation(BASE, '720:1280');

    // 720 * 0.12 = 86.4 -> rounds to 86; portrait's smaller width yields a smaller watermark, by design
    // (scale is always a fraction of output WIDTH, never height).
    expect(anim.scale).toBe('86:-1');
  });

  it('resolves a custom scale fraction to pixels', () => {
    const anim = watermarkToAnimation({ ...BASE, scale: 0.25 }, '1280:720');

    expect(anim.scale).toBe('320:-1');
  });

  it('passes a custom opacity straight through to the GlobalAnimation opacity field', () => {
    const anim = watermarkToAnimation({ ...BASE, opacity: 0.35 }, '1280:720');

    expect(anim.opacity).toBe(0.35);
  });

  it('passes a custom margin into the corner expression', () => {
    const anim = watermarkToAnimation({ ...BASE, position: 'top-left', margin: 0 }, '1280:720');

    expect(anim.position).toBe('0:0');
  });

  it('passes a large custom margin into the bottom-right corner expression', () => {
    const anim = watermarkToAnimation({ ...BASE, margin: 100 }, '1280:720');

    expect(anim.position).toBe('W-w-100:H-h-100');
  });

  it('sets neither loop nor persistent — the still-image detection in Task 1 handles both implicitly', () => {
    const anim = watermarkToAnimation(BASE, '1280:720');

    expect(anim.loop).toBeUndefined();
    expect(anim.persistent).toBeUndefined();
    expect(anim.start).toBeUndefined();
    expect(anim.duration).toBeUndefined();
  });

  // Fix 1+2: a watermark KNOWS it is a still image, so watermarkToAnimation sets the flag explicitly
  // rather than leaving AnimationComposer to sniff it from a url that may be an unresolved `{{ var }}`
  // or a `.webp` (excluded from the still regex for untyped entries). Set unconditionally, regardless
  // of the url's own extension.
  it('always sets still: true, regardless of the url extension', () => {
    expect(watermarkToAnimation(BASE, '1280:720').still).toBe(true);
    expect(watermarkToAnimation({ ...BASE, url: 'pictures/logo.webp' }, '1280:720').still).toBe(true);
    expect(watermarkToAnimation({ ...BASE, url: '{{ logoUrl }}' }, '1280:720').still).toBe(true);
  });
});

describe('hasWholeVideoOverlays', () => {
  it('is false when neither animations nor a watermark are set', () => {
    expect(hasWholeVideoOverlays(undefined)).toBe(false);
    expect(hasWholeVideoOverlays({})).toBe(false);
  });

  it('is true when global.animations has at least one entry', () => {
    expect(hasWholeVideoOverlays({ animations: [{ url: 'a.apng' }] })).toBe(true);
  });

  it('is true when global.watermark is set, even with no explicit animations', () => {
    expect(hasWholeVideoOverlays({ watermark: BASE })).toBe(true);
  });

  it('is true when both are set', () => {
    expect(hasWholeVideoOverlays({ animations: [{ url: 'a.apng' }], watermark: BASE })).toBe(true);
  });
});
