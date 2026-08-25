import { describe, expect, it } from 'vitest';
import { describeAccept } from './describe-accept';

describe('describeAccept', () => {
  it('renders the extensions as an uppercase display list', () => {
    expect(describeAccept([{ mime: 'audio/*', extensions: ['.mp3', '.wav', '.m4a'] }])).toBe('MP3, WAV, M4A');
  });

  it('keeps the spec order, so the list reads as authored', () => {
    expect(describeAccept([{ mime: 'video/*', extensions: ['.mp4', '.mov', '.webm', '.m4v'] }])).toBe(
      'MP4, MOV, WebM, M4V'
    );
  });

  // WebP and WebM are spelled that way by the formats themselves; shouting them as WEBP/WEBM is
  // wrong in the same way "PDF" would be wrong as "Pdf", and the string is interpolated into five
  // languages with no translator able to correct it.
  it('keeps the branded casing of the formats that have one', () => {
    expect(describeAccept([{ mime: 'image/webp', extensions: ['.webp'] }])).toBe('WebP');
  });

  it('flattens multiple groups', () => {
    expect(
      describeAccept([
        { mime: 'image/*', extensions: ['.jpg', '.png'] },
        { mime: 'image/avif', extensions: ['.avif'] },
      ])
    ).toBe('JPG, PNG, AVIF');
  });

  // The picture pane's real spec. The list names formats, not filename spellings — ".jpg" and
  // ".jpeg" are one format, and listing both reads as two.
  it('names one format once even when it has two extensions', () => {
    expect(describeAccept([{ mime: 'image/*', extensions: ['.jpg', '.jpeg', '.png', '.webp'] }])).toBe(
      'JPG, PNG, WebP'
    );
  });

  it('de-duplicates an extension listed in two groups', () => {
    expect(
      describeAccept([
        { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
        { mime: 'image/pjpeg', extensions: ['.jpg'] },
      ])
    ).toBe('JPG');
  });

  it('returns an empty string for an empty spec, so a caller can branch on it', () => {
    expect(describeAccept([])).toBe('');
  });
});
