// Stages the ffmpeg.wasm core into public/ffmpeg-core/<version>/ before `vite` runs (dev and build), so the
// app serves it from its own origin rather than a CDN: see src/infrastructure/ffmpeg-core.ts, which loads it.
//
// The version is the engine's FFMPEG_CORE_VERSION, the path the app requests, and the installed @ffmpeg/core
// has to match it. The wasm is gzipped on the way: Cloudflare Pages refuses any file over 25 MiB, and the raw
// core weighs ~31 MB (~10 MB gzipped).
//
// Runs as plain `node scripts/stage-ffmpeg-core.ts`, hence the `.ts` extension on the engine import.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { FFMPEG_CORE_VERSION } from 'ffmpeg-video-composer/src/platform/ffmpeg/ffmpeg-core.ts';

export interface StageOptions {
  /** The installed @ffmpeg/core package. */
  coreDir: string;
  /** The app's public/ directory. */
  publicDir: string;
}

// Through a temp file, so an interrupted run can't leave a truncated core that passes for a staged one.
const writeAtomic = (file: string, data: Uint8Array): void => {
  writeFileSync(`${file}.tmp`, data);
  renameSync(`${file}.tmp`, file);
};

/** Stage the core under `<publicDir>/ffmpeg-core/<version>/`; returns that directory. */
export function stageFFmpegCore({ coreDir, publicDir }: StageOptions): string {
  const { version } = JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf8')) as { version: string };

  if (version !== FFMPEG_CORE_VERSION) {
    throw new Error(
      `@ffmpeg/core ${version} is installed but the engine pins ${FFMPEG_CORE_VERSION} (FFMPEG_CORE_VERSION): bump both together.`
    );
  }

  const root = join(publicDir, 'ffmpeg-core');
  const dir = join(root, version);

  mkdirSync(dir, { recursive: true });

  // Only the pinned version ships: an older one left here would ride along into every deploy.
  for (const entry of readdirSync(root)) {
    if (entry !== version) rmSync(join(root, entry), { recursive: true, force: true });
  }

  // A version's files never change, so what is already staged stays; gzipping ~31 MB costs about a second.
  const js = join(dir, 'ffmpeg-core.js');
  const gz = join(dir, 'ffmpeg-core.wasm.gz');

  if (!existsSync(js)) {
    writeAtomic(js, readFileSync(join(coreDir, 'dist/esm/ffmpeg-core.js')));
  }

  if (!existsSync(gz)) {
    writeAtomic(gz, gzipSync(readFileSync(join(coreDir, 'dist/esm/ffmpeg-core.wasm')), { level: 9 }));
  }

  return dir;
}

if (import.meta.main) {
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  // The package's ESM entry is dist/esm/ffmpeg-core.js, two levels below its root.
  const coreDir = resolve(dirname(fileURLToPath(import.meta.resolve('@ffmpeg/core'))), '../..');
  const dir = stageFFmpegCore({ coreDir, publicDir: join(appDir, 'public') });

  console.log(`✓ ffmpeg core ${FFMPEG_CORE_VERSION} → ${relative(process.cwd(), dir)}`);
}
