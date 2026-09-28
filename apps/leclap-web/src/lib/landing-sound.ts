// The landing's one sound: a single switch and level for every video on the page (the hero film, the two
// films and the in-browser render) and for the hero's synthesised clapper. Switching it on anywhere turns
// it on everywhere, and muting mutes them all. Off until asked for: a landing page that makes noise at a
// visitor who didn't ask is a landing page people close. It lasts the page session and is never stored,
// because a browser only lets a page play sound once the visitor has interacted with it: a remembered "on"
// would leave the next visit's videos refusing to start.

/** Where the sound lands when it is switched on without a level of its own. */
export const DEFAULT_VOLUME = 0.7;

export interface LandingSound {
  /** Whether the sound is on. */
  enabled: boolean;
  /** The level every landing video plays at, 0..1: the last audible one, so switching on is never silence. */
  volume: number;
  /** Whether the visitor has found the sound: switched it on once, or pressed a video's own controls. */
  found: boolean;
}

/** The state before anyone touches it, which is also what a prerender sees. */
export const INITIAL_SOUND: LandingSound = { enabled: false, volume: DEFAULT_VOLUME, found: false };

let sound = INITIAL_SOUND;
const listeners = new Set<() => void>();

const update = (next: LandingSound): void => {
  sound = next;

  // A snapshot, so a listener that unsubscribes while being notified doesn't disturb this pass.
  const due = [...listeners];

  for (const listener of due) {
    listener();
  }
};

export const readSound = (): LandingSound => sound;

export const subscribeSound = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/** Switches the sound on or off for every landing video at once; switching it on counts as found. */
export const setSoundEnabled = (enabled: boolean): void => {
  if (enabled === sound.enabled) return;

  update({ ...sound, enabled, found: sound.found || enabled });
};

/** Sets the level for every landing video. Zero switches the sound off and keeps the last audible level. */
export const setSoundVolume = (volume: number): void => {
  if (volume <= 0) {
    setSoundEnabled(false);

    return;
  }

  update({ enabled: true, volume, found: true });
};

/** The visitor pressed a video's controls: they have seen where the sound is, so nothing hints at it again. */
export const markSoundFound = (): void => {
  if (sound.found) return;

  update({ ...sound, found: true });
};

// What the page last set on each video, so a change it didn't make — the native controls, under reduced
// motion — can be told apart from its own. `volumechange` fires asynchronously, often after the page has
// moved on, so comparing against the page's intent at dispatch time would misread its own writes.
const told = new WeakMap<HTMLMediaElement, { muted: boolean; volume: number }>();

/** Sets a video's sound, and remembers it as the page's own change. */
export const tellVideo = (video: HTMLMediaElement, muted: boolean, volume = video.volume): void => {
  video.volume = volume;
  video.muted = muted;
  told.set(video, { muted, volume });
};

/** Whether a video's sound differs from what the page last set on it: the visitor moved it themselves. */
export const changedByVisitor = (video: HTMLMediaElement): boolean => {
  const last = told.get(video);

  return !last || last.muted !== video.muted || Math.abs(last.volume - video.volume) > 0.01;
};

/**
 * Plays a landing video, with sound when `audible`. A browser may refuse sound to a play() that no click
 * started (Safari does, for a video the visitor never pressed): the video then plays muted instead, and
 * `onRefused` hears about it so its frame can show itself muted. A play that is merely interrupted (by a
 * pause, or a new source) is not a refusal and changes nothing.
 */
export const playWithSound = (video: HTMLVideoElement, audible: boolean, onRefused: () => void): void => {
  tellVideo(video, !audible);
  video.play().catch((error: unknown) => {
    if (!audible || !(error instanceof DOMException) || error.name !== 'NotAllowedError') return;

    tellVideo(video, true);
    onRefused();
    video.play().catch(() => {});
  });
};
