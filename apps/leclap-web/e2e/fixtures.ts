import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Bundled sample videos used by the WASM e2e specs live in the creative-kit package, OUTSIDE the web
// root — so they're served through Vite's `/@fs/<abs-path>` escape hatch. The absolute path is resolved
// at runtime from this file's location (apps/leclap-web/e2e → ../../.. = repo root), never hardcoded,
// so the specs run on any checkout/machine/CI rather than one developer's home directory.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const videosDir = path.join(repoRoot, 'packages/leclap-creative-kit/src/library/videos');

// A bundled library video referenced via Vite's filesystem prefix (e.g. sampleVideo('earth.mp4')).
export const sampleVideo = (file: string): string => `/@fs${path.join(videosDir, file)}`;
