import { describe, expect, it } from 'vitest';
import { createRenderQueue } from './render-queue';

// A promise the test settles by hand, standing in for a render still in flight.
const deferred = <T = void>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createRenderQueue', () => {
  it('hands back what the render resolves to', async () => {
    const queue = createRenderQueue();

    await expect(queue.run(() => Promise.resolve('video.mp4'))).resolves.toBe('video.mp4');
  });

  it('starts a render only once the one before it has settled', async () => {
    const queue = createRenderQueue();
    const first = deferred();
    const started: string[] = [];

    const one = queue.run(async () => {
      started.push('first');
      await first.promise;
    });
    const two = queue.run(async () => {
      started.push('second');
    });

    await tick();
    expect(started).toEqual(['first']);

    first.resolve();
    await Promise.all([one, two]);
    expect(started).toEqual(['first', 'second']);
  });

  it('still starts the next render when the one before it failed', async () => {
    const queue = createRenderQueue();

    const failed = queue.run(() => Promise.reject(new Error('moov atom not found')));
    const next = queue.run(() => Promise.resolve('ok'));

    await expect(failed).rejects.toThrow('moov atom not found');
    await expect(next).resolves.toBe('ok');
  });

  it('keeps a render current until something replaces it', async () => {
    const queue = createRenderQueue();
    let isCurrent = () => false;

    await queue.run(async (current) => {
      isCurrent = current;
    });

    expect(isCurrent()).toBe(true);
  });

  it('voids the render in flight on stop', async () => {
    const queue = createRenderQueue();
    const gate = deferred();
    let seen: boolean | undefined;

    const render = queue.run(async (isCurrent) => {
      await gate.promise;
      seen = isCurrent();
    });

    queue.stop();
    gate.resolve();
    await render;

    expect(seen).toBe(false);
  });

  it('voids an older render when a newer one is queued', async () => {
    const queue = createRenderQueue();
    const gate = deferred();
    let older = () => true;
    let newer = () => false;

    const one = queue.run(async (isCurrent) => {
      older = isCurrent;
      await gate.promise;
    });
    const two = queue.run(async (isCurrent) => {
      newer = isCurrent;
    });

    gate.resolve();
    await Promise.all([one, two]);

    expect(older()).toBe(false);
    expect(newer()).toBe(true);
  });

  it('hands a render stopped while it waited its turn a void ticket', async () => {
    const queue = createRenderQueue();
    const gate = deferred();
    let seen: boolean | undefined;

    const one = queue.run(() => gate.promise);
    const two = queue.run(async (isCurrent) => {
      seen = isCurrent();
    });

    queue.stop();
    gate.resolve();
    await Promise.all([one, two]);

    expect(seen).toBe(false);
  });
});
