import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as LandingSound from './landing-sound';

// The store is module state that lasts the page session, so every test imports a fresh copy.
type Store = typeof LandingSound;

let store: Store;

beforeEach(async () => {
  vi.resetModules();
  store = await import('./landing-sound');
});

describe('landing sound', () => {
  it('starts off, at the default level, with nothing found yet', () => {
    expect(store.readSound()).toEqual({ enabled: false, volume: store.DEFAULT_VOLUME, found: false });
  });

  it('switching on turns the sound on for every video and counts as found', () => {
    const listener = vi.fn();
    store.subscribeSound(listener);

    store.setSoundEnabled(true);

    expect(store.readSound()).toMatchObject({ enabled: true, found: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('switching off again keeps the sound found, so no frame hints at it any more', () => {
    store.setSoundEnabled(true);
    store.setSoundEnabled(false);

    expect(store.readSound()).toMatchObject({ enabled: false, found: true });
  });

  it('does not notify when the switch does not move', () => {
    const listener = vi.fn();
    store.subscribeSound(listener);

    store.setSoundEnabled(false);

    expect(listener).not.toHaveBeenCalled();
  });

  it('a level above zero switches the sound on at that level', () => {
    store.setSoundVolume(0.3);

    expect(store.readSound()).toEqual({ enabled: true, volume: 0.3, found: true });
  });

  it('a level of zero switches the sound off and keeps the last audible level for next time', () => {
    store.setSoundVolume(0.4);
    store.setSoundVolume(0);

    expect(store.readSound()).toMatchObject({ enabled: false, volume: 0.4 });

    store.setSoundEnabled(true);

    expect(store.readSound()).toMatchObject({ enabled: true, volume: 0.4 });
  });

  it('marks the sound found without switching it on', () => {
    store.markSoundFound();

    expect(store.readSound()).toEqual({ enabled: false, volume: store.DEFAULT_VOLUME, found: true });
  });

  it('stops notifying a listener once it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribeSound(listener);

    unsubscribe();
    store.setSoundEnabled(true);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('tellVideo / changedByVisitor', () => {
  const fakeVideo = () => ({ muted: false, volume: 1 }) as unknown as HTMLVideoElement;

  it('sets a video sound and remembers it as the page own change', () => {
    const video = fakeVideo();

    store.tellVideo(video, true, 0.7);

    expect(video).toMatchObject({ muted: true, volume: 0.7 });
    expect(store.changedByVisitor(video)).toBe(false);
  });

  it('tells a change the page did not make (the native controls) apart', () => {
    const video = fakeVideo();

    store.tellVideo(video, true, 0.7);
    video.muted = false;

    expect(store.changedByVisitor(video)).toBe(true);
  });

  it('counts a volume the visitor moved as their change', () => {
    const video = fakeVideo();

    store.tellVideo(video, false, 0.7);
    video.volume = 0.3;

    expect(store.changedByVisitor(video)).toBe(true);
  });

  it('keeps the current volume when told only whether to mute', () => {
    const video = fakeVideo();

    store.tellVideo(video, true);

    expect(video).toMatchObject({ muted: true, volume: 1 });
    expect(store.changedByVisitor(video)).toBe(false);
  });
});

describe('playWithSound', () => {
  const fakeVideo = (play: () => Promise<void>) => ({ muted: false, volume: 1, play: vi.fn(play) });
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('remembers the sound it plays with as the page own change', async () => {
    const video = fakeVideo(() => Promise.resolve());

    store.playWithSound(video as unknown as HTMLVideoElement, true, vi.fn());
    await flush();

    expect(store.changedByVisitor(video as unknown as HTMLVideoElement)).toBe(false);
  });

  it('plays muted while the sound is off', async () => {
    const video = fakeVideo(() => Promise.resolve());
    const onRefused = vi.fn();

    store.playWithSound(video as unknown as HTMLVideoElement, false, onRefused);
    await flush();

    expect(video.muted).toBe(true);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('plays with sound while the sound is on', async () => {
    const video = fakeVideo(() => Promise.resolve());

    store.playWithSound(video as unknown as HTMLVideoElement, true, vi.fn());
    await flush();

    expect(video.muted).toBe(false);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('falls back to a muted play, and says so, when the browser refuses the sound', async () => {
    let calls = 0;
    const video = fakeVideo(() => {
      calls += 1;

      return calls === 1 ? Promise.reject(new DOMException('no gesture', 'NotAllowedError')) : Promise.resolve();
    });
    const onRefused = vi.fn();

    store.playWithSound(video as unknown as HTMLVideoElement, true, onRefused);
    await flush();

    expect(video.muted).toBe(true);
    expect(onRefused).toHaveBeenCalledTimes(1);
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(store.changedByVisitor(video as unknown as HTMLVideoElement)).toBe(false);
  });

  it('leaves the sound alone when a play is only interrupted', async () => {
    const video = fakeVideo(() => Promise.reject(new DOMException('paused', 'AbortError')));
    const onRefused = vi.fn();

    store.playWithSound(video as unknown as HTMLVideoElement, true, onRefused);
    await flush();

    expect(video.muted).toBe(false);
    expect(onRefused).not.toHaveBeenCalled();
    expect(video.play).toHaveBeenCalledTimes(1);
  });
});
