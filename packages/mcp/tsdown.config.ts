import { defineConfig } from 'tsdown';

// External: real runtime deps + node builtins — never bundled. The worker imports the
// already-compiled core dist; the SDK and reflect-metadata stay node_modules deps.
const external = [
  'ffmpeg-video-composer',
  '@modelcontextprotocol/sdk',
  'reflect-metadata',
  'child_process',
  'node:child_process',
  'fs',
  'node:fs',
  'fs/promises',
  'node:fs/promises',
  'path',
  'node:path',
  'os',
  'node:os',
  'util',
  'node:util',
  'events',
  'node:events',
  'stream',
  'node:stream',
];

export default defineConfig([
  // CLI entry — stdio MCP server. Shebang so `leclap-mcp` runs directly.
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outExtensions: () => ({ js: '.js' }),
    dts: false,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    target: 'es2024',
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
    deps: { neverBundle: external },
  },
  // Forked render worker — emitted as dist/render-worker.js (owns fd1/fd2; runs compile()).
  {
    entry: { 'render-worker': 'src/worker/renderWorker.ts' },
    format: ['esm'],
    outExtensions: () => ({ js: '.js' }),
    dts: false,
    sourcemap: true,
    outDir: 'dist',
    target: 'es2024',
    platform: 'node',
    deps: { neverBundle: external },
  },
]);
