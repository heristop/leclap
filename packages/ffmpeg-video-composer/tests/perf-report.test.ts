import { describe, expect, it } from 'vitest';
import { ffmpegSharePct, formatPerfReport } from '@/utils/perf-report';

const report = {
  totalMs: 100,
  spans: [
    { label: 'ffmpeg:execute', ms: 80, count: 3 },
    { label: 'build:filters', ms: 20, count: 3 },
  ],
};

describe('perf-report', () => {
  it('computes ffmpeg share percentage', () => {
    expect(ffmpegSharePct(report)).toBe(80);
  });

  it('formats a table containing labels and percentages', () => {
    const out = formatPerfReport(report);
    expect(out).toContain('ffmpeg:execute');
    expect(out).toContain('build:filters');
    expect(out).toContain('80');
  });

  it('handles an empty report without dividing by zero', () => {
    expect(ffmpegSharePct({ totalMs: 0, spans: [] })).toBe(0);
    expect(formatPerfReport({ totalMs: 0, spans: [] })).toContain('total 0.0ms');
  });
});
