import { useEffect, useRef, type ChangeEvent, type RefObject } from 'react';
import { formatTimecode, playheadRatio, scrubTime } from './hero-timecode.logic';

export const SCRUB_RESOLUTION = 1000;

type VideoRef = RefObject<HTMLVideoElement | null>;

interface HeroPlayheadOptions {
  /** Run the sync loop only while the hero is actually on screen. */
  active: boolean;
  /** Reduced motion: paint once (settled) instead of running the rAF loop. */
  reduced: boolean;
}

// Mirror the film's playhead into the chrome. Module-scope (it only ever dereferences stable refs)
// so the effect below doesn't close over a per-render function.
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

  if (readout) readout.textContent = formatTimecode(film.currentTime);

  if (!range) return;

  range.valueAsNumber = Math.round(ratio * SCRUB_RESOLUTION);
  range.style.setProperty('--range-pct', `${(ratio * 100).toFixed(2)}%`);
};

// Binds the hero's program-monitor chrome to the background film: one rAF loop mirrors the
// video's playhead into the SMPTE timecode readout and the timeline scrubber (value + the
// `--range-pct` gradient fill the studio-range track reads). All writes go straight to the DOM —
// never through React state — so the 60fps sync costs zero re-renders. Scrubbing works both ways:
// dragging (or arrow-keying) the range seeks the film, which the same paint reflects immediately.
export function useHeroPlayhead(videoRef: VideoRef, { active, reduced }: HeroPlayheadOptions) {
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    paintPlayhead(videoRef, timecodeRef, scrubRef);

    if (reduced || !active) return () => {};

    let frame = requestAnimationFrame(function tick() {
      paintPlayhead(videoRef, timecodeRef, scrubRef);
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active, reduced, videoRef]);

  const onScrub = (event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;

    if (!video) return;

    video.currentTime = scrubTime(event.currentTarget.valueAsNumber / SCRUB_RESOLUTION, video.duration);
    paintPlayhead(videoRef, timecodeRef, scrubRef);
  };

  return { timecodeRef, scrubRef, onScrub };
}
