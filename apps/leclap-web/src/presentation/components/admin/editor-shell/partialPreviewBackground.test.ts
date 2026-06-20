// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolvePartialImageUrl } from './partialPreviewBackground';

describe('resolvePartialImageUrl', () => {
  it('maps a library:// marker to the curated /backgrounds url', () => {
    expect(resolvePartialImageUrl('library://forest-sea')).toBe('/backgrounds/forest-sea.jpg');
  });

  it('passes http(s) urls through', () => {
    expect(resolvePartialImageUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });

  it('passes absolute public paths through', () => {
    expect(resolvePartialImageUrl('/backgrounds/forest-sea.jpg')).toBe('/backgrounds/forest-sea.jpg');
  });

  it('returns undefined for media:// uploads (not fetchable in a static preview)', () => {
    expect(resolvePartialImageUrl('media://upload42')).toBeUndefined();
  });

  it('returns undefined for an unknown library id or empty marker', () => {
    expect(resolvePartialImageUrl('library://does-not-exist')).toBeUndefined();
    expect(resolvePartialImageUrl(undefined)).toBeUndefined();
  });
});
