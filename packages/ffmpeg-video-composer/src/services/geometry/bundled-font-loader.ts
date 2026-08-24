import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';

// Supplied by the caller, because the geometry module must stay free of filesystem and network
// access: it is imported by TemplateValidator, whose import graph reaches the browser build, the
// React-Native build, and the web app. Returning null means "not available here" and is expected,
// not an error. Defined here (rather than in the geometry barrel `index.ts`) so this module never
// imports back from that barrel — avoids a circular dependency now that the barrel re-exports
// `createBundledFontLoader` from this file.
export type FontLoader = (fontFile: string) => Promise<Uint8Array | null>;

// Builds a FontLoader over the filesystem abstraction the engine already uses to find bundled
// assets. Platform-agnostic by construction: it imports only the abstract type, so it adds nothing
// Node-specific to the geometry module's import graph. `resolveBundledFont` returns null on any
// platform that does not ship fonts locally (its base implementation is a null return), and this
// loader turns every failure — unresolved, unreadable, or thrown — into null, which the caller
// reads as "measure approximately and flag it".
export function createBundledFontLoader(filesystem: AbstractFilesystem): FontLoader {
  return async (fontFile: string): Promise<Uint8Array | null> => {
    try {
      const path = await filesystem.resolveBundledFont(fontFile);

      if (!path) {
        return null;
      }

      return await filesystem.readFile(path);
    } catch {
      return null;
    }
  };
}
