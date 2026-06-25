import { describe, it, expect } from 'vitest';
import {
  refVideoHeight,
  previewFontPx,
  fontSizeFromPreview,
  clampFraction,
  fontSizeFromResize,
} from './overlayGeometry';

describe('overlayGeometry — refVideoHeight', () => {
  it('uses 1080 for landscape and 1920 for portrait', () => {
    expect(refVideoHeight('landscape')).toBe(1080);
    expect(refVideoHeight('portrait')).toBe(1920);
  });
});

describe('overlayGeometry — previewFontPx', () => {
  it('scales a video-px fontsize to the preview box height', () => {
    // 48 video-px at a 540px preview against a 1080 reference = half size.
    expect(previewFontPx(48, 540, 'landscape')).toBe(24);
  });

  it('scales against the portrait reference height', () => {
    // 96 video-px at a 960px preview against a 1920 reference = half size.
    expect(previewFontPx(96, 960, 'portrait')).toBe(48);
  });
});

describe('overlayGeometry — fontSizeFromPreview', () => {
  it('back-computes a video-px fontsize from a dragged preview height', () => {
    expect(fontSizeFromPreview(24, 540, 'landscape')).toBe(48);
  });

  it('clamps below 8 and above 300', () => {
    expect(fontSizeFromPreview(0, 540, 'landscape')).toBe(8);
    expect(fontSizeFromPreview(10_000, 540, 'landscape')).toBe(300);
  });

  it('is the inverse of previewFontPx for in-range values', () => {
    for (const fontsize of [8, 24, 48, 100, 240, 300]) {
      const preview = previewFontPx(fontsize, 540, 'landscape');

      expect(fontSizeFromPreview(preview, 540, 'landscape')).toBe(fontsize);
    }
  });
});

describe('overlayGeometry — fontSizeFromResize', () => {
  it('grows the font when the pointer is dragged outward from the centre', () => {
    // Doubling the radial distance doubles the font size.
    expect(fontSizeFromResize(48, 100, 200)).toBe(96);
  });

  it('shrinks the font when the pointer is dragged toward the centre', () => {
    expect(fontSizeFromResize(48, 200, 100)).toBe(24);
  });

  it('keeps the font unchanged when the distance is unchanged', () => {
    expect(fontSizeFromResize(48, 150, 150)).toBe(48);
  });

  it('clamps to the [8, 300] authoring range', () => {
    expect(fontSizeFromResize(48, 100, 1)).toBe(8);
    expect(fontSizeFromResize(48, 100, 100_000)).toBe(300);
  });

  it('treats a zero grab distance as 1 to avoid dividing by zero', () => {
    expect(fontSizeFromResize(48, 0, 48)).toBe(300);
  });
});

describe('overlayGeometry — clampFraction', () => {
  it('returns the ratio within the box', () => {
    expect(clampFraction(50, 100)).toBe(0.5);
  });

  it('clamps below 0 and above 1', () => {
    expect(clampFraction(-20, 100)).toBe(0);
    expect(clampFraction(180, 100)).toBe(1);
  });
});
