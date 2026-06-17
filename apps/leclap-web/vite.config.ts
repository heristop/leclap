import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react, { type Options as ReactPluginOptions } from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

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
    },
  },
});
