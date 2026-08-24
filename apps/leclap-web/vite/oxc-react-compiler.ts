import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync, type ReactCompilerOptions } from 'oxc-transform-react';
import type { Plugin } from 'vite';

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(appDir, 'src') + path.sep;

// React Compiler infers components and hooks, so plain `.ts` modules are in scope too — a custom hook
// in `hooks/` benefits as much as a `.tsx` component.
const SOURCE_FILE = /\.[jt]sx?$/;

/**
 * Runs React Compiler through Oxc's Rust port (`oxc-transform-react`) instead of
 * `babel-plugin-react-compiler`, so the app never loads Babel at all.
 *
 * It has to be a `pre` transform: React Compiler must see the source before anything else rewrites
 * it, and `@vitejs/plugin-react` (which owns the JSX transform and Fast Refresh, also via Oxc) runs
 * as a normal plugin afterwards. `jsx: 'preserve'` is what keeps those two passes from colliding —
 * we hand plugin-react back the same JSX it expects, only with the compiler's memoization applied.
 *
 * The `src/` scoping is load-bearing: the `@/core` alias pulls
 * `packages/ffmpeg-video-composer/src/core` into this build, and those modules use TS decorators that
 * this transform is not configured to parse. Only this app's own sources go through the compiler.
 */
export function oxcReactCompiler(options: ReactCompilerOptions = {}): Plugin {
  return {
    name: 'leclap:oxc-react-compiler',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0];

      if (!file.startsWith(srcDir) || !SOURCE_FILE.test(file)) {
        return null;
      }

      const result = transformSync(file, code, {
        sourcemap: true,
        jsx: 'preserve',
        reactCompiler: options,
      });

      if (result.fatal) {
        const detail = result.errors.map((error) => error.codeframe ?? error.message).join('\n\n');

        this.error(`React Compiler could not transform ${path.relative(appDir, file)}\n\n${detail}`);
      }

      // Non-fatal entries are bail-outs: the compiler declined to memoize a function and left it
      // untouched. That is the expected steady state for a real codebase, so they stay silent —
      // surfacing them belongs in a lint pass (`outputMode: 'lint'`), not in every dev-server rebuild.
      return { code: result.code, map: result.map };
    },
  };
}
