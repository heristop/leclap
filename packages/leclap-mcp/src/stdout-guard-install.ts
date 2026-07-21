import { installStdoutGuard } from './stdoutGuard.js';

// Installs the stdout guard as an IMPORT-TIME side effect and exports the genuine fd-1 writer.
// index.ts imports this ABOVE any core-touching module (./server.js → ffmpeg-video-composer) so the
// redirect is in place before the core's import graph is evaluated — ESM runs a module's imports in
// source order, so a load-time console.log/process.stdout.write from the core or a dependency can no
// longer reach the JSON-RPC framing on fd 1. (Installing in index.ts's own body was too late: the
// import statements there are hoisted and evaluated before the body runs.)
export const out = installStdoutGuard();
