import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// A hand-driven requestAnimationFrame so tests advance the loop one frame at a time instead of
// waiting on a real display. `flush()` runs exactly the callbacks scheduled before it was called,
// which is what a browser does — a callback that re-schedules lands in the *next* frame.
function createFrameDriver() {
  let nextId = 1;
  let pending = new Map<number, FrameRequestCallback>();
  let time = 0;

  return {
    get scheduled() {
      return pending.size;
    },
    request(callback: FrameRequestCallback): number {
      const id = nextId++;
      pending.set(id, callback);

      return id;
    },
    cancel(id: number): void {
      pending.delete(id);
    },
    flush(step = 16): void {
      const due = pending;
      pending = new Map();
      time += step;

      for (const callback of due.values()) {
        callback(time);
      }
    },
  };
}

let driver: ReturnType<typeof createFrameDriver>;

async function loadTicker() {
  // The ticker is a module-level singleton, so every test gets its own instance.
  vi.resetModules();

  return import('./ticker');
}

beforeEach(() => {
  driver = createFrameDriver();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => driver.request(callback));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    driver.cancel(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ticker', () => {
  it('calls a subscriber once per frame', async () => {
    const { subscribe } = await loadTicker();
    const spy = vi.fn();

    subscribe(spy);
    driver.flush();
    expect(spy).toHaveBeenCalledTimes(1);

    driver.flush();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('passes the frame timestamp through', async () => {
    const { subscribe } = await loadTicker();
    const spy = vi.fn();

    subscribe(spy);
    driver.flush(16);
    driver.flush(16);

    expect(spy).toHaveBeenNthCalledWith(1, 16);
    expect(spy).toHaveBeenNthCalledWith(2, 32);
  });

  it('runs every subscriber in the same frame, in registration order', async () => {
    const { subscribe } = await loadTicker();
    const order: string[] = [];

    subscribe(() => order.push('first'));
    subscribe(() => order.push('second'));
    driver.flush();

    expect(order).toEqual(['first', 'second']);
  });

  it('keeps a single loop no matter how many subscribers join', async () => {
    const { subscribe } = await loadTicker();

    subscribe(vi.fn());
    subscribe(vi.fn());
    subscribe(vi.fn());

    expect(driver.scheduled).toBe(1);
  });

  it('stops calling a subscriber once it unsubscribes', async () => {
    const { subscribe } = await loadTicker();
    const spy = vi.fn();
    const unsubscribe = subscribe(spy);

    driver.flush();
    unsubscribe();
    driver.flush();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('shuts the loop down when the last subscriber leaves', async () => {
    const { subscribe } = await loadTicker();
    const unsubscribe = subscribe(vi.fn());

    driver.flush();
    expect(driver.scheduled).toBe(1);

    unsubscribe();
    driver.flush();

    expect(driver.scheduled).toBe(0);
  });

  it('restarts the loop when a subscriber joins after it went idle', async () => {
    const { subscribe } = await loadTicker();
    const unsubscribe = subscribe(vi.fn());

    unsubscribe();
    driver.flush();
    expect(driver.scheduled).toBe(0);

    const spy = vi.fn();
    subscribe(spy);
    driver.flush();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing twice does not disturb the remaining subscribers', async () => {
    const { subscribe } = await loadTicker();
    const survivor = vi.fn();
    const unsubscribe = subscribe(vi.fn());

    subscribe(survivor);
    unsubscribe();
    unsubscribe();
    driver.flush();

    expect(survivor).toHaveBeenCalledTimes(1);
  });

  it('evicts a subscriber that throws and keeps the rest running', async () => {
    const { subscribe } = await loadTicker();
    const boom = vi.fn(() => {
      throw new Error('bad frame');
    });
    const survivor = vi.fn();

    subscribe(boom);
    subscribe(survivor);

    driver.flush();
    driver.flush();

    expect(boom).toHaveBeenCalledTimes(1);
    expect(survivor).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the environment has no requestAnimationFrame', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined);

    const { subscribe } = await loadTicker();
    const unsubscribe = subscribe(vi.fn());

    expect(() => {
      unsubscribe();
    }).not.toThrow();
  });
});
