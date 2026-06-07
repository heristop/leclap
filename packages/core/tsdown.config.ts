import { defineConfig } from 'tsdown';
import replace from '@rollup/plugin-replace';

export default defineConfig([
  // Node.js build
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    // tsdown >=0.20 emits .mjs by default; keep .js so package entry points resolve.
    outExtensions: () => ({ js: '.js' }),
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    target: 'es2024',
    platform: 'node',
    external: [
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
    external: [
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
    noExternal: [
      // Only include browser-compatible dependencies
      'reflect-metadata',
      'tsyringe',
      'picocolors',
      'zod',
    ],
    plugins: [
      replace({
        preventAssignment: true,
        delimiters: [String.raw`\b`, String.raw`\b`],
        values: {
          'process.env.NODE_ENV': JSON.stringify('production'),
          'process.env.PLATFORM': JSON.stringify('browser'),
          global: 'globalThis',
        },
      }),
    ],
  },
]);
