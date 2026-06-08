import type * as FFmpegExpo from 'ffmpeg-expo';

/**
 * Whether the native ffmpeg-expo module is present in the running build. Dev clients built before
 * ffmpeg-expo was added (or Expo Go) won't have it, so the hybrid router must check before trying
 * an on-device compile and fall back to the server otherwise. Cached after the first probe.
 */
let cached: boolean | undefined;

export function isFFmpegAvailable(): boolean {
  if (cached !== undefined) {
    return cached;
  }

  try {
    const mod = require('ffmpeg-expo') as typeof FFmpegExpo;
    cached = Boolean(mod.getVersion().version);
  } catch {
    cached = false;
  }

  return cached;
}

/** Test seam: reset the memoized probe. */
export function __resetFFmpegAvailability(): void {
  cached = undefined;
}
