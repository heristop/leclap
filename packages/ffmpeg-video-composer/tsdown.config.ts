import { defineConfig } from 'tsdown';
import replace from '@rollup/plugin-replace';

export default defineConfig([
  // Node.js build
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    // tsdown >=0.20 emits .mjs/.cjs by default when both formats are present; keep the
    // ESM entry as index.js so the package's module/exports fields resolve.
    outExtensions: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    target: 'es2024',
    platform: 'node',
    // Ship the bundled .ttf fonts inside the package so Node/server/MCP renders resolve drawtext
    // fonts locally (FilesystemNodeAdapter.resolveBundledFont looks in dist/fonts) instead of
    // downloading them from Google Fonts. dist is already in package.json "files".
    copy: [{ from: 'src/shared/library/fonts/*.ttf', to: 'dist/fonts' }],
    deps: {
      neverBundle: [
        'child_process',
        'fs',
        'path',
        'os',
        'util',
        'events',
        'node:events',
        'stream',
        'crypto',
        'readline',
        'tty',
        'extract-zip',
        'boxen',
        'figlet',
        'gradient-string',
        'cli-spinners',
        'pino',
        'pino-pretty',
        'ffmpeg-static',
      ],
    },
  },
  // CLI build — emitted as dist/cli.js so the package `bin` resolves inside the
  // published tarball (the old src/cli/executable.js pointed outside the package).
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    outExtensions: () => ({ js: '.js' }),
    dts: false,
    sourcemap: true,
    outDir: 'dist',
    target: 'es2024',
    platform: 'node',
    banner: '#!/usr/bin/env node',
    deps: {
      neverBundle: [
        'child_process',
        'fs',
        'path',
        'os',
        'util',
        'events',
        'node:events',
        'stream',
        'crypto',
        'readline',
        'tty',
        'extract-zip',
        'boxen',
        'figlet',
        'gradient-string',
        'cli-spinners',
        'pino',
        'pino-pretty',
        'ffmpeg-static',
      ],
    },
  },
  // Browser build - excludes Node.js-specific modules
  {
    entry: ['src/browser.ts'],
    format: ['esm'],
    outExtensions: () => ({ js: '.js' }),
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    target: 'es2024',
    platform: 'browser',
    globalName: 'FFmpegVideoComposer',
    deps: {
      neverBundle: [
        // Keep these as external for browser bundlers to handle
        '@ffmpeg/ffmpeg',
        '@ffmpeg/util',
        // Exclude all Node.js-specific modules from browser build
        'child_process',
        'fs',
        'fs/promises',
        'path',
        'os',
        'util',
        'events',
        'stream',
        'crypto',
        'readline',
        'tty',
        'extract-zip',
        'boxen',
        'figlet',
        'gradient-string',
        'cli-spinners',
        'pino',
        'pino-pretty',
        'ffmpeg-static',
        'zlib',
        'yauzl',
        'fd-slicer',
        'get-stream',
      ],
      alwaysBundle: [
        // Only include browser-compatible dependencies
        'reflect-metadata',
        'tsyringe',
        'picocolors',
        'zod',
      ],
    },
    plugins: [
      replace({
        preventAssignment: true,
        delimiters: [String.raw`\b`, String.raw`\b`],
        // Only rewrite `global` in the JS bundle. Without this exclude the same
        // substitution mangles reflect-metadata's inlined `declare global {` into the
        // invalid `declare globalThis {` in the generated .d.ts, breaking tsc consumers.
        exclude: ['**/*.d.ts'],
        values: {
          'process.env.NODE_ENV': JSON.stringify('production'),
          'process.env.PLATFORM': JSON.stringify('browser'),
          global: 'globalThis',
        },
      }),
    ],
  },
  // React-Native build — ships PRE-COMPILED JS so Hermes never sees the core's tsyringe decorators
  // (Metro/Babel won't transform a symlinked workspace package's decorators; pre-building avoids the
  // problem entirely). Decorators are compiled by tsdown (experimentalDecorators + emitDecoratorMetadata);
  // reflect-metadata stays external (the app imports it once at its entry).
  {
    entry: ['src/reactnative.ts'],
    format: ['esm'],
    outExtensions: () => ({ js: '.js' }),
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    target: 'es2024',
    platform: 'neutral',
    inputOptions: {
      resolve: {
        // `neutral` ignores the `main` field, but tsyringe ships CJS (main only) and is in
        // `alwaysBundle` below — without this rolldown can't resolve it, so it externalizes
        // tsyringe (the RN output must inline it so Hermes never transforms its decorators).
        mainFields: ['module', 'browser', 'main'],
      },
    },
    deps: {
      neverBundle: [
        'expo-file-system',
        'expo-file-system/legacy',
        'reflect-metadata',
        'child_process',
        'fs',
        'fs/promises',
        'path',
        'os',
        'util',
        'events',
        'stream',
        'crypto',
        'extract-zip',
        'boxen',
        'figlet',
        'gradient-string',
        'cli-spinners',
        'pino',
        'pino-pretty',
        'ffmpeg-static',
        '@ffmpeg/ffmpeg',
        '@ffmpeg/util',
      ],
      alwaysBundle: ['tsyringe', 'zod'],
    },
  },
]);
