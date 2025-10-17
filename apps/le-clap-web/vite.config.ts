import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      // Enable polyfills for specific globals and modules
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Enable polyfill for specific Node.js modules
      protocolImports: true,
    }),
  ],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  resolve: {
    alias: {
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
        'extract-zip',
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
      ],
    },
  },
});
