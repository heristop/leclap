import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepScreenAwake } from './screen-wake-lock';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function makeLock() {
  return { released: false, release: vi.fn().mockResolvedValue(undefined) };
}

describe('screen wake lock', () => {
  let page: EventTarget & { visibilityState: string };
  let lock: ReturnType<typeof makeLock>;
  let request: ReturnType<typeof vi.fn>;
  const cleanups: Array<() => void> = [];
  const start = () => {
    const stop = keepScreenAwake();
    cleanups.push(stop);

    return stop;
  };
  const visibility = async (state: string) => {
    page.visibilityState = state;
    page.dispatchEvent(new Event('visibilitychange'));
    await flush();
  };

  beforeEach(() => {
    page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    lock = makeLock();
    request = vi.fn().mockResolvedValue(lock);
    vi.stubGlobal('document', page);
    vi.stubGlobal('navigator', { wakeLock: { request } });
  });

  afterEach(() => {
    for (const stop of cleanups.splice(0)) stop();
    vi.unstubAllGlobals();
  });

  it('holds a screen lock only for the operation lifetime', async () => {
    const stop = start();
    await flush();
    expect(request).toHaveBeenCalledWith('screen');
    await visibility('visible');
    expect(request).toHaveBeenCalledTimes(1);
    stop();
    expect(lock.release).toHaveBeenCalledTimes(1);
    await visibility('visible');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('releases on hiding and reacquires when the page returns', async () => {
    start();
    await flush();
    await visibility('hidden');
    expect(lock.release).toHaveBeenCalledTimes(1);
    const next = makeLock();
    request.mockResolvedValue(next);
    await visibility('visible');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('waits for visibility when started in the background', async () => {
    page.visibilityState = 'hidden';
    start();
    expect(request).not.toHaveBeenCalled();
    await visibility('visible');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('releases a late grant after cancellation without leaking a lock', async () => {
    let grant!: (value: ReturnType<typeof makeLock>) => void;
    request.mockReturnValue(
      new Promise((resolve) => {
        grant = resolve;
      })
    );
    const stop = start();
    await visibility('visible');
    expect(request).toHaveBeenCalledTimes(1);
    stop();
    grant(lock);
    await flush();
    expect(lock.release).toHaveBeenCalledTimes(1);
  });

  it('does not interrupt work when the browser refuses a lock', async () => {
    request.mockRejectedValue(new Error('Power saving'));
    start();
    await flush();
    request.mockResolvedValue(lock);
    await visibility('visible');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not release another concurrent operation’s lock', async () => {
    const other = makeLock();
    request.mockResolvedValueOnce(lock).mockResolvedValueOnce(other);
    const stop = start();
    start();
    await flush();
    stop();
    expect(lock.release).toHaveBeenCalledTimes(1);
    expect(other.release).not.toHaveBeenCalled();
  });

  it('supports browsers without the API and server-side imports', () => {
    vi.stubGlobal('navigator', {});
    expect(() => start()()).not.toThrow();
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('navigator', undefined);
    expect(() => start()()).not.toThrow();
  });
});
