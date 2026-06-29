import path from 'node:path';
import type { ProjectConfig } from 'ffmpeg-video-composer';

// Pure assembly of a render's ProjectConfig from CLI flags — kept out of the command so it is unit
// testable without touching the filesystem or the engine.

export interface RenderFlags {
  /** Repeatable `--field key=value`, merged into `fields` (template variables / form values). */
  field?: string[];
  /** Repeatable `--video section=path`, merged into `userVideoPaths` (paths resolved vs cwd). */
  video?: string[];
  /** `--locale` → `currentLocale`. */
  locale?: string;
  /** `--orientation` → `videoConfig.orientation`. */
  orientation?: string;
  /** `--assets` dir override (resolved vs cwd; defaults to `<cwd>/assets`). */
  assets?: string;
  /** `--build` dir override (resolved vs cwd; defaults to `<cwd>/build`). */
  build?: string;
}

// Parse repeatable `key=value` flag values into a record. Splits on the FIRST `=` so values may
// contain `=` (e.g. a URL query). `label` is the flag name, used in the error message.
export function parseKeyValues(pairs: string[] | undefined, label: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const pair of pairs ?? []) {
    const eq = pair.indexOf('=');

    if (eq === -1) {
      throw new Error(`--${label} expects key=value, got "${pair}"`);
    }

    const key = pair.slice(0, eq).trim();

    if (!key) {
      throw new Error(`--${label} expects key=value, got "${pair}"`);
    }

    out[key] = pair.slice(eq + 1).trim();
  }

  return out;
}

// Assemble the ProjectConfig for a render. buildDir/assetsDir default to cwd-relative dirs; the rest of
// the config is only set when the matching flag was passed, so unset flags leave engine defaults intact.
export function buildProjectConfig(cwd: string, flags: RenderFlags): ProjectConfig & { buildDir: string } {
  const buildDir = flags.build ? path.resolve(cwd, flags.build) : path.resolve(cwd, 'build');
  const assetsDir = flags.assets ? path.resolve(cwd, flags.assets) : path.resolve(cwd, 'assets');

  const config: ProjectConfig & { buildDir: string } = {
    buildDir,
    assetsDir,
    fields: parseKeyValues(flags.field, 'field'),
  };

  const videos = parseKeyValues(flags.video, 'video');

  if (Object.keys(videos).length > 0) {
    config.userVideoPaths = Object.fromEntries(
      Object.entries(videos).map(([section, file]) => [section, path.resolve(cwd, file)])
    );
  }

  if (flags.locale) {
    config.currentLocale = flags.locale;
  }

  if (flags.orientation) {
    config.videoConfig = { orientation: flags.orientation };
  }

  return config;
}
