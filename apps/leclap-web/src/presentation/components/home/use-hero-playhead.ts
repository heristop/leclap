import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { subscribe } from '@/lib/ticker';
import { formatTimecode, playheadRatio, scrubTime } from './hero-timecode.logic';

export const SCRUB_RESOLUTION = 1000;

// An arrow press moves the playhead a whole second: the range's own step (a thousandth of the film) is
// shorter than one frame, so native arrow keys would appear to do nothing.
const ARROW_SEEK: Readonly<Partial<Record<string, number>>> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

// The keys the range moves natively (by a tenth, or to either end). They seek through onChange, but they
// hold the film like the arrows do, or playback would carry on from wherever they landed — from the end,
// straight back round to the start.
const NATIVE_SEEK_KEYS: ReadonlySet<string> = new Set(['Home', 'End', 'PageUp', 'PageDown']);

// Seeks stop just short of the last frame: the film loops, so landing exactly on its end would wrap the
// playhead back to the start.
const END_GUARD = 0.05;

type VideoRef = RefObject<HTMLVideoElement | null>;
type Describe = (seconds: number, total: number) => string;

interface HeroPlayheadOptions {
  /** Run the sync loop only while the film can move: the hero on screen, and not paused. */
  active: boolean;
  /** The scrubber's spoken value, e.g. "12 of 18 seconds": the raw 0–1000 position means nothing aloud. */
  describe: Describe;
}

const clampSeek = (seconds: number, duration: number): number =>
  Math.min(Math.max(0, duration - END_GUARD), Math.max(0, seconds));

// Mirror the film's playhead into the chrome. Module-scope (it only ever dereferences stable refs)
// so the effect below doesn't close over a per-render function. Every write is guarded by an
// equality check: re-assigning an unchanged textContent/value still dirties layout and paint, so
// ticks where the frame readout hasn't advanced cost nothing. The fill is checked on its own, not
// only when the value moves: a drag or a Home/End key has already set the value by the time the
// seek is painted, and the track's gradient must still catch up with the thumb. The spoken value
// changes once a second at most.
const paintPlayhead = (
  video: VideoRef,
  timecode: RefObject<HTMLSpanElement | null>,
  scrub: RefObject<HTMLInputElement | null>,
  describe: RefObject<Describe>
): void => {
  const film = video.current;

  if (!film) return;

  const ratio = playheadRatio(film.currentTime, film.duration);
  const readout = timecode.current;
  const range = scrub.current;

  if (readout) {
    const text = formatTimecode(film.currentTime);

    if (readout.textContent !== text) readout.textContent = text;
  }

  if (!range) return;

  const value = Math.round(ratio * SCRUB_RESOLUTION);
  const fill = `${(ratio * 100).toFixed(2)}%`;
  const total = Number.isFinite(film.duration) ? Math.round(film.duration) : 0;
  const spoken = describe.current(Math.round(film.currentTime), total);

  if (range.valueAsNumber !== value) range.valueAsNumber = value;

  if (range.style.getPropertyValue('--range-pct') !== fill) range.style.setProperty('--range-pct', fill);

  if (range.getAttribute('aria-valuetext') !== spoken) range.setAttribute('aria-valuetext', spoken);
};

// Binds the hero's program-monitor chrome to the background film: the video's playhead is mirrored
// into the SMPTE timecode readout and the timeline scrubber (value + the `--range-pct` gradient fill
// the studio-range track reads, and its spoken value). All writes go straight to the DOM — never
// through React state — so the sync costs zero re-renders.
//
// The paint rides the shared page ticker, upgrading to requestVideoFrameCallback as soon as the
// idle-mounted video exists — once per presented frame (~24-30fps) rather than every display frame —
// and dropping off the ticker at that point. Scrubbing works both ways: dragging (or arrow-keying)
// the range seeks the film, which the same paint reflects immediately. While the visitor holds the
// playhead — dragging it, keying it, or keyboard focus on it — `scrubbing` is up and the hero holds
// the film still, so playback neither tugs the thumb out from under them nor announces a new value
// every second.
export function useHeroPlayhead(videoRef: VideoRef, { active, describe }: HeroPlayheadOptions) {
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const describeRef = useRef(describe);
  const [scrubbing, setScrubbing] = useState(false);

  // The describer closes over the current language; the paint reads it through a ref so a re-render
  // doesn't tear down the frame loop.
  useEffect(() => {
    describeRef.current = describe;
  });

  useEffect(() => {
    paintPlayhead(videoRef, timecodeRef, scrubRef, describeRef);

    if (!active) return () => {};

    let videoFrameId = 0;
    let filmWithCallback: HTMLVideoElement | null = null;
    let unsubscribe: (() => void) | null = null;

    function onVideoFrame() {
      paintPlayhead(videoRef, timecodeRef, scrubRef, describeRef);

      if (!filmWithCallback) return;

      videoFrameId = filmWithCallback.requestVideoFrameCallback(onVideoFrame);
    }

    // The film mounts lazily (on browser idle), so the upgrade is retried each frame until it exists.
    function upgradeToVideoFrames(): boolean {
      const film = videoRef.current;

      if (!film || !('requestVideoFrameCallback' in film)) return false;

      filmWithCallback = film;
      videoFrameId = film.requestVideoFrameCallback(onVideoFrame);

      return true;
    }

    unsubscribe = subscribe(() => {
      paintPlayhead(videoRef, timecodeRef, scrubRef, describeRef);

      if (filmWithCallback) return;

      if (upgradeToVideoFrames()) {
        unsubscribe?.();
        unsubscribe = null;
      }
    });

    return () => {
      unsubscribe?.();
      filmWithCallback?.cancelVideoFrameCallback(videoFrameId);
    };
  }, [active, videoRef]);

  const onScrub = (event: ChangeEvent<HTMLInputElement>) => {
    const ratio = event.currentTarget.valueAsNumber / SCRUB_RESOLUTION;
    const video = videoRef.current;

    if (!video) return;

    video.currentTime = clampSeek(scrubTime(ratio, video.duration), video.duration);
    paintPlayhead(videoRef, timecodeRef, scrubRef, describeRef);
  };

  /** Arrow keys seek a second at a time and hold the film; returns whether the key seeked here. */
  const onScrubKey = (event: KeyboardEvent<HTMLInputElement>): boolean => {
    if (NATIVE_SEEK_KEYS.has(event.key)) {
      setScrubbing(true);

      return false;
    }

    const delta = ARROW_SEEK[event.key];
    const video = videoRef.current;

    if (delta === undefined || !video || !Number.isFinite(video.duration)) return false;

    event.preventDefault();
    setScrubbing(true);
    video.currentTime = clampSeek(video.currentTime + delta, video.duration);
    paintPlayhead(videoRef, timecodeRef, scrubRef, describeRef);

    return true;
  };

  // Pointer holds end on release; keyboard holds (focus, or a key after a click) end on blur. A click
  // also focuses the range, but not as :focus-visible, so a drag hands playback back on pointer-up.
  // The release is heard on the window: a drag can end outside the input, or outside the page, where
  // the input never sees it.
  const scrubHandlers = {
    onPointerDown: () => {
      setScrubbing(true);

      const release = () => {
        setScrubbing(false);
        globalThis.removeEventListener('pointerup', release);
        globalThis.removeEventListener('pointercancel', release);
      };
      globalThis.addEventListener('pointerup', release);
      globalThis.addEventListener('pointercancel', release);
    },
    onFocus: (event: FocusEvent<HTMLInputElement>) => {
      paintPlayhead(videoRef, timecodeRef, scrubRef, describeRef);

      if (event.currentTarget.matches(':focus-visible')) setScrubbing(true);
    },
    onBlur: () => {
      setScrubbing(false);
    },
  };

  return { timecodeRef, scrubRef, onScrub, onScrubKey, scrubbing, scrubHandlers };
}
