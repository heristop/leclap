import { describe, expect, it } from 'vitest';
import { formatTimecode, playheadRatio, scrubTime } from './hero-timecode.logic';

describe('formatTimecode', () => {
  it('renders zero as an SMPTE zero timecode', () => {
    expect(formatTimecode(0)).toBe('00:00:00:00');
  });

  it('splits seconds into HH:MM:SS:FF at the given frame rate', () => {
    expect(formatTimecode(3.5, 24)).toBe('00:00:03:12');
    expect(formatTimecode(3661.5, 24)).toBe('01:01:01:12');
  });

  it('never reaches the frame-rate ceiling on fractional rounding', () => {
    expect(formatTimecode(3.999, 24)).toBe('00:00:03:23');
  });

  it('clamps negative and non-finite input to zero', () => {
    expect(formatTimecode(-4)).toBe('00:00:00:00');
    expect(formatTimecode(Number.NaN)).toBe('00:00:00:00');
  });
});

describe('playheadRatio', () => {
  it('maps the current time onto 0..1 of the duration', () => {
    expect(playheadRatio(2, 8)).toBeCloseTo(0.25, 5);
  });

  it('clamps past-the-end positions to 1', () => {
    expect(playheadRatio(9, 8)).toBe(1);
  });

  it('returns 0 for an unknown or empty duration', () => {
    expect(playheadRatio(2, 0)).toBe(0);
    expect(playheadRatio(2, Number.NaN)).toBe(0);
  });
});

describe('scrubTime', () => {
  it('maps a 0..1 ratio back to seconds', () => {
    expect(scrubTime(0.5, 10)).toBeCloseTo(5, 5);
  });

  it('clamps the ratio into range', () => {
    expect(scrubTime(1.4, 10)).toBe(10);
    expect(scrubTime(-0.2, 10)).toBe(0);
  });

  it('returns 0 for an unknown duration', () => {
    expect(scrubTime(0.5, Number.NaN)).toBe(0);
  });
});
