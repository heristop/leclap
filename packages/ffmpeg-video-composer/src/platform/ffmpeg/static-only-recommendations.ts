import { FFPROBE_MISSING_MESSAGE } from './resolve-ffprobe';

/**
 * Recommendations when renders fall back to ffmpeg-static. Without an ffprobe, templates that probe
 * media can't render there, so that gap and its fix replace the performance advice.
 */
export function staticOnlyRecommendations(ffprobe: boolean | undefined): string[] {
  if (ffprobe === false) {
    return [`⚠️ ${FFPROBE_MISSING_MESSAGE}`];
  }

  return [
    '⚡ Consider installing system FFmpeg for faster processing',
    '📦 Current static FFmpeg works great but is slower',
  ];
}
