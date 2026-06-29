import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react, { type Options as ReactPluginOptions } from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

// Vendor libraries that load on every page, each pinned to a stable chunk name (see manualChunks).
// They change far less often than app code, so an app-only release no longer busts their cache and the
// browser fetches them in parallel. Order doesn't matter — the regexes are mutually exclusive.
const VENDOR_GROUPS: { test: RegExp; name: string }[] = [
  {
    test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
    name: 'vendor-react',
  },
  { test: /[\\/]node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/, name: 'vendor-motion' },
  { test: /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/, name: 'vendor-i18n' },
  { test: /[\\/]node_modules[\\/]lucide-react[\\/]/, name: 'vendor-icons' },
];

export default defineConfig({
  plugins: [
    // React Compiler runs through the React plugin's own Babel pass, which only
    // transforms this app's JSX/TSX. A standalone Babel preset would also try to
    // compile packages/ffmpeg-video-composer (which uses TS decorators) and fail to parse them.
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    } as ReactPluginOptions & { babel?: { plugins?: unknown[] } }),
    tailwindcss(),
    nodePolyfills({
      // Enable polyfills for specific globals and modules
      globals: {
        Buffer: true,
        global: true,
        process: false,
      },
      // Enable polyfill for specific Node.js modules
      protocolImports: true,
    }),
  ],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    cors: {
      origin: true,
      credentials: true,
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  resolve: {
    alias: {
      // Mirror tsconfig's `@/core/*` → core-src mapping (must precede the general `@`): the core
      // package uses `@/core/...` internally, so a runtime import like `@/core/argGuard` pulled into
      // this build must resolve to the core src, not this app's src. (Type-only `@/core/types` was
      // erased and never needed this; value imports do.)
      '@/core': path.resolve(projectDir, '../../packages/ffmpeg-video-composer/src/core'),
      '@': path.resolve(projectDir, 'src'),
      // Provide browser-compatible alternatives for Node.js modules
      path: 'path-browserify',
      os: 'os-browserify',
      events: 'events',
      util: 'util',
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      buffer: 'buffer',
      fs: 'memfs',
      'fs/promises': 'memfs',
    },
  },
  build: {
    rollupOptions: {
      external: [
        // Exclude Node.js-only modules that can't be polyfilled
        'boxen',
        'figlet',
        'gradient-string',
        'cli-spinners',
        'child_process',
        'readline',
        'tty',
        'pino',
        'pino-pretty',
        'node:fs',
        'node:path',
        'node:os',
        'node:process',
        'node:util',
        'node:child_process',
        'fs/promises',
        'zlib',
        'yauzl',
        'fd-slicer',
        'get-stream',
      ],
      output: {
        // Pull only the libraries that load on every page (React, the router, i18n, motion, the shared
        // UI primitives) into stable, separately-cacheable vendor chunks: they change far less often
        // than app code, so an app-only release no longer busts their cache and the browser fetches
        // them in parallel. Everything else returns undefined so the bundler keeps splitting it per
        // route — a catch-all `vendor` would instead merge lazy-route-only deps into the eager path.
        manualChunks(id): string | undefined {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          // Each entry is a library (or set) that loads on every page; assigning it a fixed chunk name
          // keeps it in a stable, separately-cacheable group. Radix and react-dropzone are intentionally
          // absent — they're editor/upload-only, so they stay unassigned and split into their own lazy
          // route chunks instead of riding along on the landing page.
          const group = VENDOR_GROUPS.find(({ test }) => test.test(id));

          return group?.name;
        },
      },
    },
  },
});
