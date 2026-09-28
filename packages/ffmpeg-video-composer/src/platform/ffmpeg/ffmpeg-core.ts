/**
 * The ffmpeg.wasm core (`@ffmpeg/core`) the WASM adapter runs on, pinned once for every browser host: the
 * web app self-hosts exactly this version, and a host that brings no loader of its own gets it from unpkg.
 */
export const FFMPEG_CORE_VERSION = '0.12.10';

/** The part of ffmpeg.wasm's `FFmpeg` a core loader drives. */
export interface FFmpegCoreTarget {
  load(config: { coreURL: string; wasmURL: string }): Promise<unknown>;
}

/** Loads the core into an ffmpeg.wasm instance: where the core comes from is the host's call. */
export type FFmpegCoreLoader = (ffmpeg: FFmpegCoreTarget) => Promise<void>;

// The default loader: the pinned core from unpkg, handed over as blob URLs so the module worker can import
// it across origins.
export async function loadCoreFromCdn(ffmpeg: FFmpegCoreTarget): Promise<void> {
  const { toBlobURL } = await import('@ffmpeg/util');
  const baseURL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
}
