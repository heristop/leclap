import { describe, expect, it } from 'vitest';
import { matches, pickerAccept } from './accept';
import type { AcceptSpec } from './types';

const VIDEO: AcceptSpec = [{ mime: 'video/*', extensions: ['.mp4', '.mkv'] }];
const ANIM: AcceptSpec = [
  { mime: 'image/apng', extensions: ['.apng'] },
  { mime: 'video/webm', extensions: ['.webm'] },
];

const file = (name: string, type: string): File => new File([''], name, { type });

describe('pickerAccept', () => {
  it('emits a wildcard group as the bare MIME so mobile keeps Camera and Photo Library', () => {
    expect(pickerAccept(VIDEO)).toBe('video/*');
  });

  it('emits concrete groups with their extensions', () => {
    expect(pickerAccept(ANIM)).toBe('image/apng,.apng,video/webm,.webm');
  });
});

describe('matches', () => {
  it('accepts any member of a wildcard family, not just the listed extensions', () => {
    expect(matches(file('clip.mpeg', 'video/mpeg'), VIDEO)).toBe(true);
  });

  it('falls back to the extension when the browser reports no type', () => {
    expect(matches(file('clip.mkv', ''), VIDEO)).toBe(true);
  });

  it('compares extensions case-insensitively', () => {
    expect(matches(file('CLIP.MP4', ''), VIDEO)).toBe(true);
  });

  it('rejects an unrelated file', () => {
    expect(matches(file('notes.pdf', 'application/pdf'), VIDEO)).toBe(false);
  });

  it('matches any group in a multi-group spec', () => {
    expect(matches(file('loop.webm', 'video/webm'), ANIM)).toBe(true);
  });

  it('accepts everything when the spec is empty', () => {
    expect(matches(file('anything.bin', ''), [])).toBe(true);
  });
});
