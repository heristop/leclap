import { describe, expect, it } from 'vitest';
import { PerfTimer, createPerfTimer, getPerfTimer, resetPerfTimer } from '@/utils/perf-timer';

describe('PerfTimer', () => {
  it('records a span via start/end and aggregates repeated labels', () => {
    const t = new PerfTimer(true);
    t.start('a');
    t.end('a');
    t.start('a');
    t.end('a');
    const report = t.report();
    const a = report.spans.find((s) => s.label === 'a');
    expect(a?.count).toBe(2);
    expect(a?.ms).toBeGreaterThanOrEqual(0);
  });

  it('span() returns the wrapped value and records timing', async () => {
    const t = new PerfTimer(true);
    const result = await t.span('work', async () => 42);
    expect(result).toBe(42);
    expect(t.report().spans.some((s) => s.label === 'work')).toBe(true);
  });

  it('is a no-op when disabled', async () => {
    const t = new PerfTimer(false);
    t.start('a');
    t.end('a');
    const result = await t.span('work', () => 7);
    expect(result).toBe(7);
    expect(t.report()).toEqual({ totalMs: 0, spans: [] });
  });

  it('createPerfTimer is disabled when FVC_PERF is unset', () => {
    const prev = process.env.FVC_PERF;
    delete process.env.FVC_PERF;
    const t = createPerfTimer();
    t.start('a');
    t.end('a');
    expect(t.report()).toEqual({ totalMs: 0, spans: [] });
    if (prev !== undefined) {
      process.env.FVC_PERF = prev;
    }
  });

  it('createPerfTimer is enabled when FVC_PERF=1', () => {
    const prev = process.env.FVC_PERF;
    process.env.FVC_PERF = '1';
    const t = createPerfTimer();
    t.start('a');
    t.end('a');
    expect(t.report().spans.some((s) => s.label === 'a')).toBe(true);
    if (prev === undefined) {
      delete process.env.FVC_PERF;
      return;
    }
    process.env.FVC_PERF = prev;
  });

  it('getPerfTimer returns a stable instance and resetPerfTimer replaces it', () => {
    const prev = process.env.FVC_PERF;
    process.env.FVC_PERF = '1';
    const first = getPerfTimer();
    expect(getPerfTimer()).toBe(first);
    const next = resetPerfTimer();
    expect(next).not.toBe(first);
    expect(getPerfTimer()).toBe(next);
    if (prev === undefined) {
      delete process.env.FVC_PERF;
      return;
    }
    process.env.FVC_PERF = prev;
  });
});
