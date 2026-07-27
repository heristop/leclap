import { useEffect, useRef, type ChangeEvent, type RefObject } from 'react';
import { subscribe } from '@/lib/ticker';
import { formatTimecode, playheadRatio, scrubTime } from './hero-timecode.logic';

export const SCRUB_RESOLUTION = 1000;

type VideoRef = RefObject<HTMLVideoElement | null>;

interface HeroPlayheadOptions {
  /** Run the sync loop only while the hero is actually on screen. */
  active: boolean;
  /** Reduced motion: paint once (settled) instead of subscribing to the ticker. */
  reduced: boolean;
}

// Mirror the film's playhead into the chrome. Module-scope (it only ever dereferences stable refs)
// so the effect below doesn't close over a per-render function. Every write is guarded by an
// equality check: re-assigning an unchanged textContent/value still dirties layout and paint, so
// ticks where the frame readout hasn't advanced cost nothing.
const paintPlayhead = (
  video: VideoRef,
  timecode: RefObject<HTMLSpanElement | null>,
  scrub: RefObject<HTMLInputElement | null>
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

  if (range.valueAsNumber !== value) {
    range.valueAsNumber = value;
    range.style.setProperty('--range-pct', `${(ratio * 100).toFixed(2)}%`);
  }
};

// Binds the hero's program-monitor chrome to the background film: the video's playhead is mirrored
// into the SMPTE timecode readout and the timeline scrubber (value + the `--range-pct` gradient fill
// the studio-range track reads). All writes go straight to the DOM — never through React state — so
// the sync costs zero re-renders.
//
// The paint rides the shared page ticker, upgrading to requestVideoFrameCallback as soon as the
// idle-mounted video exists — once per presented frame (~24-30fps) rather than every display frame —
// and dropping off the ticker at that point. Scrubbing works both ways: dragging (or arrow-keying)
// the range seeks the film, which the same paint reflects immediately.
export function useHeroPlayhead(videoRef: VideoRef, { active, reduced }: HeroPlayheadOptions) {
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    paintPlayhead(videoRef, timecodeRef, scrubRef);

    if (reduced || !active) return () => {};

    let videoFrameId = 0;
    let filmWithCallback: HTMLVideoElement | null = null;
    let unsubscribe: (() => void) | null = null;

    function onVideoFrame() {
      paintPlayhead(videoRef, timecodeRef, scrubRef);

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
      paintPlayhead(videoRef, timecodeRef, scrubRef);

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
  }, [active, reduced, videoRef]);

  const onScrub = (event: ChangeEvent<HTMLInputElement>) => {
    const ratio = event.currentTarget.valueAsNumber / SCRUB_RESOLUTION;
    const video = videoRef.current;

    if (!video) return;

    video.currentTime = scrubTime(ratio, video.duration);
    paintPlayhead(videoRef, timecodeRef, scrubRef);
  };

  return { timecodeRef, scrubRef, onScrub };
}
