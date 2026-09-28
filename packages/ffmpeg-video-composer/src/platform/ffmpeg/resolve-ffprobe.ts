export interface FfprobeLookup {
  /** Loads a package the way `createRequire(import.meta.url)` does; throws when it isn't installed. */
  requireModule: (id: string) => unknown;
  exists: (path: string) => boolean;
}

// Points at installing FFmpeg: it brings ffprobe and moves renders onto the faster system path. The
// optional ffprobe-static package also covers every template, but bundles a binary for every platform.
export const FFPROBE_MISSING_MESSAGE =
  'ffprobe not found: ffmpeg-static ships only ffmpeg, and transitions, music, overlays and video clips need ' +
  'ffprobe to read media info. Install FFmpeg, which includes ffprobe (macOS: brew install ffmpeg · ' +
  'Linux: sudo apt install ffmpeg · Windows: https://ffmpeg.org/download.html).';

function ffprobeStaticPath(lookup: FfprobeLookup): string | null {
  try {
    const ffprobeStatic = lookup.requireModule('ffprobe-static') as { path?: string };

    return ffprobeStatic.path ?? null;
  } catch {
    return null;
  }
}

// `…/ffmpeg` → `…/ffprobe` and `…\ffmpeg.exe` → `…\ffprobe.exe`. Only the binary's own name is swapped;
// any other name has no counterpart, and falling through to the unchanged path would probe with ffmpeg.
function ffprobeBeside(ffmpegPath: string | null): string | null {
  // Empty alternatives rather than optional groups, so both groups always capture a string.
  const match = ffmpegPath?.match(/^(.*[\\/]|)ffmpeg(\.exe|)$/i);

  if (!match) {
    return null;
  }

  return `${match[1]}ffprobe${match[2]}`;
}

/**
 * The ffprobe binary for the ffmpeg-static adapter, or null when there is none. ffmpeg-static ships ONLY
 * an ffmpeg binary, so ffprobe comes from the optional ffprobe-static package, or from an ffprobe beside
 * the resolved ffmpeg (FFMPEG_BIN pointed at a full FFmpeg install, or one dropped in by hand). Every
 * candidate is existence-checked: the name-swapped path used to be trusted blindly, so the missing
 * binary surfaced as a bare probe failure only after every segment had rendered.
 */
export function resolveStaticFfprobe(ffmpegPath: string | null, lookup: FfprobeLookup): string | null {
  const candidates = [ffprobeStaticPath(lookup), ffprobeBeside(ffmpegPath)];

  return candidates.find((candidate): candidate is string => candidate !== null && lookup.exists(candidate)) ?? null;
}
