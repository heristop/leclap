import { describe, expect, it } from 'vitest';
import { describeAccept } from './describe-accept';

describe('describeAccept', () => {
  it('renders the extensions as an uppercase display list', () => {
    expect(describeAccept([{ mime: 'audio/*', extensions: ['.mp3', '.wav', '.m4a'] }])).toBe('MP3, WAV, M4A');
  });

  it('keeps the spec order, so the list reads as authored', () => {
    expect(describeAccept([{ mime: 'video/*', extensions: ['.mp4', '.mov', '.webm', '.m4v'] }])).toBe(
      'MP4, MOV, WEBM, M4V'
    );
  });

  it('flattens multiple groups', () => {
    expect(
      describeAccept([
        { mime: 'image/*', extensions: ['.jpg', '.png'] },
        { mime: 'image/avif', extensions: ['.avif'] },
      ])
    ).toBe('JPG, PNG, AVIF');
  });

  it('de-duplicates an extension listed in two groups', () => {
    expect(
      describeAccept([
        { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
        { mime: 'image/pjpeg', extensions: ['.jpg'] },
      ])
    ).toBe('JPG, JPEG');
  });

  it('returns an empty string for an empty spec, so a caller can branch on it', () => {
    expect(describeAccept([])).toBe('');
  });
});
