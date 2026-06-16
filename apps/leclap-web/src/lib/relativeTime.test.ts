import { describe, it, expect } from 'vitest';
import { relativeTime } from './relativeTime';

const NOW = 1_000_000_000_000;
const ago = (ms: number) => relativeTime(NOW - ms, NOW);

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  it('reads "just now" under a minute', () => {
    expect(ago(10 * SEC)).toEqual({ key: 'justNow', count: 0 });
  });

  it('counts minutes, hours, and days', () => {
    expect(ago(5 * MIN)).toEqual({ key: 'minutes', count: 5 });
    expect(ago(3 * HOUR)).toEqual({ key: 'hours', count: 3 });
    expect(ago(2 * DAY)).toEqual({ key: 'days', count: 2 });
  });

  it('rolls up into weeks and months', () => {
    expect(ago(10 * DAY)).toEqual({ key: 'weeks', count: 1 });
    expect(ago(60 * DAY)).toEqual({ key: 'months', count: 2 });
  });

  it('never reports a future time as negative', () => {
    expect(ago(-5 * MIN)).toEqual({ key: 'justNow', count: 0 });
  });
});
