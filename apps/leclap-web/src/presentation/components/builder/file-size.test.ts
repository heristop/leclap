import { describe, it, expect } from 'vitest';
import { formatBytes } from './file-size';

describe('formatBytes', () => {
  it('reads a render in megabytes, one decimal while it is small', () => {
    expect(formatBytes(2_148_000, 'en')).toBe('2.1 MB');
    expect(formatBytes(24_600_000, 'en')).toBe('25 MB');
  });

  it('speaks the locale’s units and separators', () => {
    expect(formatBytes(2_148_000, 'fr')).toBe('2,1 Mo');
    expect(formatBytes(2_148_000, 'de')).toBe('2,1 MB');
  });

  it('steps down to kilobytes and up to gigabytes', () => {
    expect(formatBytes(812_400, 'en')).toBe('812 kB');
    expect(formatBytes(1_250_000_000, 'en')).toBe('1.3 GB');
  });

  it('counts decimal units, as the file browser the video is saved into does', () => {
    expect(formatBytes(1_000_000, 'en')).toBe('1 MB');
  });
});
