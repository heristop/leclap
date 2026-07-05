// Pure playhead math for the cinematic hero's program-monitor chrome — no DOM, so it unit-tests
// cleanly. The timecode reads like an NLE's SMPTE counter (HH:MM:SS:FF).

const pad = (value: number): string => String(value).padStart(2, '0');

// Clamp arbitrary media time to a safe, finite, non-negative number of seconds.
const safeSeconds = (seconds: number): number => (Number.isFinite(seconds) && seconds > 0 ? seconds : 0);

/** Format seconds as an SMPTE-style timecode (HH:MM:SS:FF) at the given frame rate. */
export const formatTimecode = (seconds: number, fps = 24): string => {
  const total = safeSeconds(seconds);
  const whole = Math.floor(total);
  const frames = Math.min(fps - 1, Math.floor((total - whole) * fps));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);

  return `${pad(hours)}:${pad(minutes)}:${pad(whole % 60)}:${pad(frames)}`;
};

/** Where the playhead sits along the film, 0..1. Unknown/empty durations read as 0. */
export const playheadRatio = (currentTime: number, duration: number): number => {
  if (!Number.isFinite(duration) || duration <= 0) return 0;

  return Math.min(1, Math.max(0, currentTime / duration));
};

/** Map a 0..1 scrub ratio back to seconds of the film. Unknown durations scrub to 0. */
export const scrubTime = (ratio: number, duration: number): number => {
  if (!Number.isFinite(duration) || duration <= 0) return 0;

  return Math.min(1, Math.max(0, ratio)) * duration;
};
