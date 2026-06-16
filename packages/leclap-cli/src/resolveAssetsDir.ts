import { existsSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

// Pick the assets directory for a CLI render. Prefer the caller's own `<cwd>/assets`; when that
// doesn't exist, fall back to the bundled demo media in the sibling creative-kit package so
// `leclap <demo-template>` renders from the monorepo with no setup. `moduleDir` is the directory of
// the CLI entry module (`dist/index.js` once built) — it sits one level under the package root, so
// the bundled media is at `<moduleDir>/../../leclap-creative-kit/src/library`. In a published install
// creative-kit isn't present, so this falls through to the `<cwd>/assets` default. `exists` is
// injectable for tests.
export function resolveAssetsDir(
  cwd: string,
  moduleDir: string,
  exists: (target: string) => boolean = existsSync
): string {
  const local = path.resolve(cwd, 'assets');

  if (exists(local)) return local;

  const demo = path.resolve(moduleDir, '../../leclap-creative-kit/src/library');

  if (exists(demo)) {
    console.log(`${pc.dim('Using bundled demo assets:')} ${demo}`);

    return demo;
  }

  return local;
}
