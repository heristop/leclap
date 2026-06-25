import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from '@/utils/concurrency';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('runWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    const items = [30, 10, 20, 0];
    const results = await runWithConcurrency(items, 2, async (ms, i) => {
      await delay(ms);

      return `${i}:${ms}`;
    });

    expect(results).toEqual(['0:30', '1:10', '2:20', '3:0']);
  });

  it('never runs more than `limit` tasks concurrently', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = [1, 2, 3, 4, 5, 6];

    await runWithConcurrency(items, 2, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await delay(5);
      inFlight -= 1;
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(1);
  });

  it('behaves like Promise.all when limit >= item count', async () => {
    const items = [1, 2, 3];
    const results = await runWithConcurrency(items, 10, async (n) => n * 2);

    expect(results).toEqual([2, 4, 6]);
  });

  it('handles an empty list', async () => {
    const results = await runWithConcurrency([], 3, async (n) => n);

    expect(results).toEqual([]);
  });

  it('propagates the first rejection', async () => {
    const items = [1, 2, 3];

    await expect(
      runWithConcurrency(items, 2, async (n) => {
        if (n === 2) {
          throw new Error('boom');
        }

        return n;
      })
    ).rejects.toThrow('boom');
  });
});
