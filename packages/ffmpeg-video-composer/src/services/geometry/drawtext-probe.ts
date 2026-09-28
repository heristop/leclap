// Node-only: does the FFmpeg the engine will render with have `drawtext`? A build without libfreetype
// (Homebrew's current bottle, several distro minimal builds) drops the filter, and every section with
// text then fails deep inside the render with `No such filter: 'drawtext'`. The rendered check asks
// once per binary, up front, and says what to install instead of surfacing that render error.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { FFmpegAvailability, type FFmpegDetectionResult } from '../../platform/ffmpeg/FFmpegDetector';

const execFileAsync = promisify(execFile);

// Reads `<binary> -hide_banner -filters`. Injected so the probe is testable without spawning FFmpeg.
export type FiltersRunner = (binary: string) => Promise<string>;

// A filter line is its flag column (`T.C`, `TS`, `..`) then the filter name, so only the second token
// names a filter; the legend (`T.. = Timeline support`) has `=` there and descriptions come later.
export function listsDrawtext(filtersOutput: string): boolean {
  return filtersOutput.split('\n').some((line) => line.trim().split(/\s+/)[1] === 'drawtext');
}

// The binary the engine's adapter runs for this detection: FFmpegNodeAdapter execs `ffmpeg` from PATH
// (the detector reports that as `system`), FFmpegStaticAdapter the ffmpeg-static path. Nothing to
// probe otherwise.
export function ffmpegBinary(detection: FFmpegDetectionResult): string | null {
  if (detection.availability === FFmpegAvailability.SYSTEM) {
    return 'ffmpeg';
  }

  if (detection.availability === FFmpegAvailability.STATIC && detection.path) {
    return detection.path;
  }

  return null;
}

export function noDrawtextReason(binary: string): string {
  const where = binary === 'ffmpeg' ? 'ffmpeg (on PATH)' : binary;

  return `FFmpeg at ${where} has no drawtext filter (built without libfreetype) — install ffmpeg-static or a full build`;
}

/**
 * One answer per binary path, kept for the life of the process: a binary's filter list does not change
 * under it. The promise is what is cached, so concurrent callers share one spawn. A probe that cannot
 * run proves nothing is missing, so it answers true and lets the render fail on its own terms.
 */
export function createDrawtextProbe(run: FiltersRunner): (binary: string) => Promise<boolean> {
  const answers = new Map<string, Promise<boolean>>();

  return (binary) => {
    const known = answers.get(binary);

    if (known) {
      return known;
    }

    const answer = run(binary).then(listsDrawtext, () => true);

    answers.set(binary, answer);

    return answer;
  };
}

async function readFilters(binary: string): Promise<string> {
  const { stdout } = await execFileAsync(binary, ['-hide_banner', '-filters']);

  return stdout;
}

export const hasDrawtext = createDrawtextProbe(readFilters);
