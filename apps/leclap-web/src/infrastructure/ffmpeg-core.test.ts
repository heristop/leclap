import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolveObjectURL } from 'node:buffer';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FFMPEG_CORE_VERSION } from 'ffmpeg-video-composer/src/platform/ffmpeg/ffmpeg-core.ts';
import { loadSelfHostedCore } from '@/infrastructure/ffmpeg-core';
import { stageFFmpegCore } from '../../scripts/stage-ffmpeg-core.ts';

const CORE_JS = 'export default function createFFmpegCore() {}';
// A wasm module's own header (`\0asm`, version 1) and a few body bytes.
const WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x2a, 0x07]);

type ObjectURLBlob = ReturnType<typeof resolveObjectURL>;

// Answer fetches the way this origin does: `read` maps a path to its body, and anything it can't is a 404.
const serveFiles = (read: (url: string) => Uint8Array | string | undefined) => {
  const requested: string[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requested.push(url);
      const body = read(url);

      if (body === undefined) return new Response('Not found', { status: 404 });

      // Copied into a plain ArrayBuffer-backed view: a Buffer may sit on a shared pool, which no body takes.
      return new Response(typeof body === 'string' ? body : new Uint8Array(body));
    })
  );

  return requested;
};

const serve = (files: Record<string, Uint8Array | string>) => serveFiles((url) => files[url]);

const corePath = (file: string) => `/ffmpeg-core/${FFMPEG_CORE_VERSION}/${file}`;

// What a load hands the worker: the blobs behind the URLs, read back while they still exist.
const recordLoad = () => {
  const loads: { coreURL: string; wasmURL: string; core: ObjectURLBlob; wasm: ObjectURLBlob }[] = [];
  const target = {
    load: vi.fn(async (config: { coreURL: string; wasmURL: string }) => {
      loads.push({ ...config, core: resolveObjectURL(config.coreURL), wasm: resolveObjectURL(config.wasmURL) });
    }),
  };

  return { loads, target };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadSelfHostedCore', () => {
  it('loads the core from this origin, inflating the gzipped wasm', async () => {
    const requested = serve({
      [corePath('ffmpeg-core.js')]: CORE_JS,
      [corePath('ffmpeg-core.wasm.gz')]: gzipSync(WASM),
    });
    const { loads, target } = recordLoad();

    await loadSelfHostedCore(target);

    expect(requested.sort()).toEqual([corePath('ffmpeg-core.js'), corePath('ffmpeg-core.wasm.gz')]);
    expect(loads).toHaveLength(1);
    expect(await loads[0].core?.text()).toBe(CORE_JS);
    expect(loads[0].core?.type).toBe('text/javascript');
    expect(new Uint8Array(await loads[0].wasm!.arrayBuffer())).toEqual(WASM);
    // The type instantiateStreaming insists on, so the worker compiles the module as it streams.
    expect(loads[0].wasm?.type).toBe('application/wasm');
  });

  it('hands over a wasm the server already decoded as it is', async () => {
    serve({ [corePath('ffmpeg-core.js')]: CORE_JS, [corePath('ffmpeg-core.wasm.gz')]: WASM });
    const { loads, target } = recordLoad();

    await loadSelfHostedCore(target);

    expect(new Uint8Array(await loads[0].wasm!.arrayBuffer())).toEqual(WASM);
  });

  it('fails on a missing file, naming it, rather than loading a bad core', async () => {
    serve({ [corePath('ffmpeg-core.js')]: CORE_JS });
    const { target } = recordLoad();

    await expect(loadSelfHostedCore(target)).rejects.toThrow(`${corePath('ffmpeg-core.wasm.gz')} answered 404`);
    expect(target.load).not.toHaveBeenCalled();
  });

  it('releases the blob URLs once the core is loaded', async () => {
    serve({ [corePath('ffmpeg-core.js')]: CORE_JS, [corePath('ffmpeg-core.wasm.gz')]: gzipSync(WASM) });
    const { loads, target } = recordLoad();

    await loadSelfHostedCore(target);

    expect(resolveObjectURL(loads[0].coreURL)).toBeUndefined();
    expect(resolveObjectURL(loads[0].wasmURL)).toBeUndefined();
  });

  it('releases the blob URLs when the load fails too', async () => {
    serve({ [corePath('ffmpeg-core.js')]: CORE_JS, [corePath('ffmpeg-core.wasm.gz')]: gzipSync(WASM) });
    const urls: string[] = [];
    const target = {
      load: vi.fn(async ({ coreURL, wasmURL }: { coreURL: string; wasmURL: string }) => {
        urls.push(coreURL, wasmURL);
        throw new Error('worker died');
      }),
    };

    await expect(loadSelfHostedCore(target)).rejects.toThrow('worker died');
    expect(urls).toHaveLength(2);
    expect(urls.map((url) => resolveObjectURL(url))).toEqual([undefined, undefined]);
  });
});

// The build-time half: scripts/stage-ffmpeg-core.ts puts in public/ what loadSelfHostedCore requests.
describe('stageFFmpegCore', () => {
  let root: string;
  let coreDir: string;
  let publicDir: string;

  // A stand-in for the installed @ffmpeg/core package: its manifest and the ESM build the app serves.
  const writeCorePackage = (version: string) => {
    mkdirSync(join(coreDir, 'dist/esm'), { recursive: true });
    writeFileSync(join(coreDir, 'package.json'), JSON.stringify({ name: '@ffmpeg/core', version }));
    writeFileSync(join(coreDir, 'dist/esm/ffmpeg-core.js'), CORE_JS);
    writeFileSync(join(coreDir, 'dist/esm/ffmpeg-core.wasm'), WASM);
  };

  const staged = (file: string) => join(publicDir, 'ffmpeg-core', FFMPEG_CORE_VERSION, file);

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'stage-ffmpeg-core-'));
    coreDir = join(root, 'core');
    publicDir = join(root, 'public');
    mkdirSync(publicDir);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('stages the core the self-hosted loader serves, byte for byte', async () => {
    writeCorePackage(FFMPEG_CORE_VERSION);
    stageFFmpegCore({ coreDir, publicDir });
    serveFiles((url) => {
      const file = join(publicDir, url);

      return existsSync(file) ? readFileSync(file) : undefined;
    });
    const { loads, target } = recordLoad();

    await loadSelfHostedCore(target);

    expect(await loads[0].core?.text()).toBe(CORE_JS);
    expect(new Uint8Array(await loads[0].wasm!.arrayBuffer())).toEqual(WASM);
  });

  it('stages the wasm gzipped, so it fits the 25 MiB a Cloudflare Pages file may weigh', () => {
    writeCorePackage(FFMPEG_CORE_VERSION);
    stageFFmpegCore({ coreDir, publicDir });

    const gz = readFileSync(staged('ffmpeg-core.wasm.gz'));

    expect([...gz.subarray(0, 2)]).toEqual([0x1f, 0x8b]);
    expect(new Uint8Array(gunzipSync(gz))).toEqual(WASM);
  });

  it('drops the core versions it no longer ships', () => {
    writeCorePackage(FFMPEG_CORE_VERSION);
    mkdirSync(join(publicDir, 'ffmpeg-core/0.0.1'), { recursive: true });
    writeFileSync(join(publicDir, 'ffmpeg-core/0.0.1/ffmpeg-core.js'), 'old');

    stageFFmpegCore({ coreDir, publicDir });

    expect(existsSync(join(publicDir, 'ffmpeg-core/0.0.1'))).toBe(false);
    expect(existsSync(staged('ffmpeg-core.js'))).toBe(true);
  });

  it('restages a staged file that went missing', () => {
    writeCorePackage(FFMPEG_CORE_VERSION);
    stageFFmpegCore({ coreDir, publicDir });
    rmSync(staged('ffmpeg-core.js'));

    stageFFmpegCore({ coreDir, publicDir });

    expect(readFileSync(staged('ffmpeg-core.js'), 'utf8')).toBe(CORE_JS);
    expect(existsSync(staged('ffmpeg-core.wasm.gz'))).toBe(true);
  });

  it('refuses a core the engine is not pinned to, staging nothing', () => {
    writeCorePackage('0.0.0-other');

    expect(() => stageFFmpegCore({ coreDir, publicDir })).toThrow(
      `@ffmpeg/core 0.0.0-other is installed but the engine pins ${FFMPEG_CORE_VERSION}`
    );
    expect(existsSync(join(publicDir, 'ffmpeg-core'))).toBe(false);
  });
});
