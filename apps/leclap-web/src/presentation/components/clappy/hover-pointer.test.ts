import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The page, faked for node: a window and a document to dispatch pointer events on, and a hand-driven
// requestAnimationFrame (as in lib/ticker.test.ts), so a test advances the page one frame at a time.
let page: EventTarget;
let doc: EventTarget & { visibilityState: DocumentVisibilityState };
let frames: FrameRequestCallback[];
let add: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;

const flush = (): void => {
  const due = frames;
  frames = [];

  for (const callback of due) {
    callback(performance.now());
  }
};

const pointer = (type: string, fields: Record<string, unknown>): void => {
  page.dispatchEvent(Object.assign(new Event(type), fields));
};

const move = (x: number, y: number, pointerType = 'mouse'): void => {
  pointer('pointermove', { clientX: x, clientY: y, pointerType });
};

async function loadPointer() {
  // A module-level singleton, like the ticker it runs on: every test gets fresh ones.
  vi.resetModules();

  return import('./hover-pointer');
}

beforeEach(() => {
  page = new EventTarget();
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
  frames = [];
  add = vi.fn((...args: Parameters<EventTarget['addEventListener']>) => {
    page.addEventListener(...args);
  });
  remove = vi.fn((...args: Parameters<EventTarget['removeEventListener']>) => {
    page.removeEventListener(...args);
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('addEventListener', add);
  vi.stubGlobal('removeEventListener', remove);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('hover pointer', () => {
  it('listens for nothing until someone watches, and lets go of the page when the last one leaves', async () => {
    const { subscribeHoverPointer } = await loadPointer();

    expect(add).not.toHaveBeenCalled();

    const first = subscribeHoverPointer(() => {});
    const second = subscribeHoverPointer(() => {});
    const installed = add.mock.calls.length;

    expect(installed).toBeGreaterThan(0);

    first();

    expect(remove).not.toHaveBeenCalled();

    second();

    expect(remove).toHaveBeenCalledTimes(installed);
  });

  it('publishes the newest position once a frame, however many moves arrive', async () => {
    const { readHoverPointer, subscribeHoverPointer } = await loadPointer();
    const listener = vi.fn();

    subscribeHoverPointer(listener);
    move(10, 20);
    move(30, 40);
    move(50, 60);

    expect(readHoverPointer()).toBeNull();
    expect(listener).not.toHaveBeenCalled();

    flush();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(readHoverPointer()).toEqual({ x: 50, y: 60 });
  });

  it('ignores a finger, which hovers nowhere, and lets go when one touches the screen', async () => {
    const { readHoverPointer, subscribeHoverPointer } = await loadPointer();
    const listener = vi.fn();

    subscribeHoverPointer(listener);
    move(10, 20, 'touch');
    flush();

    expect(readHoverPointer()).toBeNull();
    expect(listener).not.toHaveBeenCalled();

    move(10, 20, 'pen');
    flush();

    expect(readHoverPointer()).toEqual({ x: 10, y: 20 });

    pointer('pointerdown', { clientX: 80, clientY: 90, pointerType: 'touch' });
    flush();

    expect(readHoverPointer()).toBeNull();
  });

  it('lets go when the pointer leaves the window, the window loses focus or the page is hidden', async () => {
    const { readHoverPointer, subscribeHoverPointer } = await loadPointer();

    subscribeHoverPointer(() => {});
    move(10, 20);
    pointer('pointerout', { relatedTarget: {}, pointerType: 'mouse' });
    flush();

    expect(readHoverPointer()).toEqual({ x: 10, y: 20 });

    pointer('pointerout', { relatedTarget: null, pointerType: 'mouse' });
    flush();

    expect(readHoverPointer()).toBeNull();

    move(10, 20);
    page.dispatchEvent(new Event('blur'));
    flush();

    expect(readHoverPointer()).toBeNull();

    move(10, 20);
    flush();
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    flush();

    expect(readHoverPointer()).toBeNull();
  });

  it('lets go of a pointer left resting for a few seconds, counting from its last move', async () => {
    const { readHoverPointer, subscribeHoverPointer } = await loadPointer();
    const listener = vi.fn();

    subscribeHoverPointer(listener);
    move(10, 20);
    flush();
    vi.advanceTimersByTime(3000);
    move(30, 40);
    flush();
    vi.advanceTimersByTime(3500);
    flush();

    expect(readHoverPointer()).toEqual({ x: 30, y: 40 });

    vi.advanceTimersByTime(1000);
    flush();

    expect(readHoverPointer()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('tells its watchers when the page scrolls under a pointer that stays put', async () => {
    const { readHoverPointer, subscribeHoverPointer } = await loadPointer();
    const listener = vi.fn();

    subscribeHoverPointer(listener);
    page.dispatchEvent(new Event('scroll'));
    flush();

    expect(listener).not.toHaveBeenCalled();

    move(10, 20);
    flush();
    page.dispatchEvent(new Event('scroll'));
    flush();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(readHoverPointer()).toEqual({ x: 10, y: 20 });
  });
});
