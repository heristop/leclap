import path from 'node:path';

// The assets directory for a CLI render: the caller's own `<cwd>/assets`. The CLI deliberately does
// not reach into any other workspace package — bundled fonts and LUTs come from the engine
// (ffmpeg-video-composer, a real dependency) and music is fetched by name, so a published install needs
// nothing beyond the user's own `assets/`. Presentation (which dir was chosen) is left to the caller so
// the render command can fold it into its branded status block.
export function resolveAssetsDir(cwd: string): string {
  return path.resolve(cwd, 'assets');
}
