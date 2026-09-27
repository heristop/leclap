import { subscribe as onFrame } from '@/lib/ticker';

// Where the visitor is pointing, shared by every Clappy on the page: one set of passive listeners, there only
// while someone watches, and one update a frame at most however many of him are watching. Only a pointer that
// hovers counts (a mouse, a trackpad, a pen): a finger has no position between taps. The pointer lets go (null)
// when it leaves the window, the window loses focus or the page is hidden, a finger touches the screen, or it
// rests for IDLE_MS: a cursor left parked isn't pointing at anything any more. Nothing here runs until the
// first watcher subscribes, so a prerender never touches the page.

/** The pointer's position in the viewport, in px. */
export interface HoverPointer {
  x: number;
  y: number;
}

/** How long a pointer may rest and still count, in ms. */
const IDLE_MS = 4000;

const PASSIVE = { passive: true } as const;
const CAPTURE = { capture: true, passive: true } as const;

const listeners = new Set<() => void>();
// The newest event's position, and the one published on the frame after it.
let latest: HoverPointer | null = null;
let published: HoverPointer | null = null;
let movedAt = 0;
let idle: ReturnType<typeof setTimeout> | undefined;
let cancelFrame: (() => void) | undefined;

const publish = (): void => {
  cancelFrame?.();
  cancelFrame = undefined;
  published = latest;

  // A snapshot, so a watcher that stops watching while being told doesn't disturb this pass.
  const due = [...listeners];

  for (const listener of due) {
    listener();
  }
};

/** Publishes on the next frame: a burst of events inside one frame costs one update. */
const schedule = (): void => {
  cancelFrame ??= onFrame(publish);
};

const letGo = (): void => {
  if (latest === null) return;

  latest = null;
  schedule();
};

// Timed from the last move, and re-armed only when it fires, so moving never costs more than a timestamp.
const checkRest = (): void => {
  const left = IDLE_MS - (performance.now() - movedAt);

  if (left > 0) {
    idle = setTimeout(checkRest, left);

    return;
  }

  idle = undefined;
  letGo();
};

const onPointer = (event: PointerEvent): void => {
  if (event.pointerType === 'touch') {
    letGo();

    return;
  }

  latest = { x: event.clientX, y: event.clientY };
  movedAt = performance.now();
  idle ??= setTimeout(checkRest, IDLE_MS);
  schedule();
};

const onOut = (event: PointerEvent): void => {
  // Out to nothing on the page: the pointer has left the window.
  if (event.relatedTarget === null) letGo();
};

const onVisibility = (): void => {
  if (document.visibilityState === 'hidden') letGo();
};

// The page moved under a pointer that stayed put: it points somewhere else now, so its watchers look again.
const onScroll = (): void => {
  if (latest !== null) schedule();
};

const install = (): void => {
  globalThis.addEventListener('pointermove', onPointer, PASSIVE);
  globalThis.addEventListener('pointerdown', onPointer, PASSIVE);
  globalThis.addEventListener('pointerout', onOut, PASSIVE);
  globalThis.addEventListener('blur', letGo);
  globalThis.addEventListener('scroll', onScroll, CAPTURE);
  document.addEventListener('visibilitychange', onVisibility);
};

// Only `capture` tells one listener from another, so it is all the removals repeat.
const uninstall = (): void => {
  globalThis.removeEventListener('pointermove', onPointer);
  globalThis.removeEventListener('pointerdown', onPointer);
  globalThis.removeEventListener('pointerout', onOut);
  globalThis.removeEventListener('blur', letGo);
  globalThis.removeEventListener('scroll', onScroll, { capture: true });
  document.removeEventListener('visibilitychange', onVisibility);
  clearTimeout(idle);
  cancelFrame?.();
  idle = undefined;
  cancelFrame = undefined;
  latest = null;
  published = null;
};

/**
 * Watches the pointer: `listener` hears of each change, at most once a frame. Returns the way to stop; the last
 * watcher to stop takes the listeners off the page. Shaped for useSyncExternalStore, with readHoverPointer.
 */
export const subscribeHoverPointer = (listener: () => void): (() => void) => {
  if (listeners.size === 0) install();

  listeners.add(listener);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) uninstall();
  };
};

/** Where the pointer was on the last frame it changed, or null when none is hovering the page. */
export const readHoverPointer = (): HoverPointer | null => published;
