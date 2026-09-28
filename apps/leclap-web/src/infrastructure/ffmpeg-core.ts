// The ffmpeg.wasm core both the trim/crop pass and the render engine run on. It's served from this origin
// (scripts/stage-ffmpeg-core.ts stages it into public/ on dev and build) under a versioned path, so both
// share one download, which the HTTP cache and the service worker keep, offline included. The wasm is
// staged gzipped: Cloudflare Pages refuses a file over 25 MiB, and the raw core weighs ~31 MB.
import { FFMPEG_CORE_VERSION, type FFmpegCoreLoader } from 'ffmpeg-video-composer/src/platform/ffmpeg/ffmpeg-core.ts';

const CORE_PATH = `/ffmpeg-core/${FFMPEG_CORE_VERSION}`;

// A 404 would otherwise reach the worker as a "wasm" and fail there, far from its cause.
async function fetchCoreFile(file: string): Promise<Response> {
  const url = `${CORE_PATH}/${file}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ffmpeg core unavailable: ${url} answered ${response.status}`);
  }

  return response;
}

// Inflate the staged gzip, unless the server already did (a Content-Encoding the browser decoded for us).
async function wasmBlob(response: Response): Promise<Blob> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const body = gzipped ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')) : bytes;

  // instantiateStreaming only takes an application/wasm response, and then compiles the module as it reads.
  return new Response(body, { headers: { 'Content-Type': 'application/wasm' } }).blob();
}

export const loadSelfHostedCore: FFmpegCoreLoader = async (ffmpeg) => {
  const [core, wasm] = await Promise.all([fetchCoreFile('ffmpeg-core.js'), fetchCoreFile('ffmpeg-core.wasm.gz')]);
  const coreURL = URL.createObjectURL(new Blob([await core.arrayBuffer()], { type: 'text/javascript' }));
  const wasmURL = URL.createObjectURL(await wasmBlob(wasm));

  try {
    await ffmpeg.load({ coreURL, wasmURL });
  } finally {
    // The worker holds the core once it has loaded it: drop the page's ~31 MB copy.
    URL.revokeObjectURL(coreURL);
    URL.revokeObjectURL(wasmURL);
  }
};
