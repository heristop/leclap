import fs from 'node:fs/promises';
import path from 'node:path';

// Resolve `p` and assert it stays under `mediaDir`, symlink-safe. Both sides are passed through
// fs.realpath so a symlink inside the media dir can't point a "valid" path at an outside target.
// Returns the canonical realpath on success; throws a clear Error otherwise. Mirrors the
// defense-in-depth check in server-app/compile.ts (processFilePart), hardened against symlinks.
export async function assertWithinMediaDir(p: string, mediaDir: string): Promise<string> {
  if (!path.isAbsolute(p)) {
    throw new Error(`Path must be absolute: ${p}`);
  }

  const real = await realpathOrThrow(p);
  const realMedia = await realpathOrThrow(mediaDir);

  if (real !== realMedia && !real.startsWith(realMedia + path.sep)) {
    throw new Error(`Path escapes the media directory: ${p}`);
  }

  return real;
}

async function realpathOrThrow(p: string): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch {
    throw new Error(`Path does not exist: ${p}`);
  }
}
