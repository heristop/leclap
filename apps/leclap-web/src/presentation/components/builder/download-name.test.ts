import { describe, it, expect } from 'vitest';
import { downloadName } from './download-name';

// Local time on purpose: the date in the name is the day the viewer rendered it.
const RENDERED = new Date(2026, 8, 27, 14, 30);

describe('downloadName', () => {
  it('names the file after the project and the render date', () => {
    expect(downloadName('Present Yourself', RENDERED)).toBe('present-yourself-2026-09-27.mp4');
  });

  it('folds accents and punctuation into a plain slug', () => {
    expect(downloadName('Présente-toi, Élodie !', RENDERED)).toBe('presente-toi-elodie-2026-09-27.mp4');
  });

  it('falls back to the brand when the title has nothing to slug', () => {
    expect(downloadName('', RENDERED)).toBe('leclap-2026-09-27.mp4');
    expect(downloadName('✨ ✨', RENDERED)).toBe('leclap-2026-09-27.mp4');
    expect(downloadName(undefined, RENDERED)).toBe('leclap-2026-09-27.mp4');
  });

  it('caps a long title without leaving a dangling dash', () => {
    const name = downloadName('A really quite remarkably long template name for a video about nothing', RENDERED);

    expect(name).toBe('a-really-quite-remarkably-long-template-2026-09-27.mp4');
  });

  it('pads single-digit months and days', () => {
    expect(downloadName('Reel', new Date(2027, 0, 5))).toBe('reel-2027-01-05.mp4');
  });
});
