// whisper.cpp ggml models: never bundled, downloaded once on an explicit opt-in (`--download-model`,
// `download: true` or LECLAP_WHISPER_DOWNLOAD=1) from the official ggerganov/whisper.cpp repository into a
// user cache, and SHA-256-verified before use. LECLAP_WHISPER_MODEL points at a model file of your own.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TRANSCRIBE_MODELS } from '../../schemas/transcribe.schemas';

export type WhisperModelName = (typeof TRANSCRIBE_MODELS)[number];

export interface WhisperModelSpec {
  file: string;
  sha256: string;
  bytes: number;
  url: string;
}

const REPO = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

// SHA-256 of the multilingual models, as published (git LFS oid) on huggingface.co/ggerganov/whisper.cpp.
export const WHISPER_MODELS: Record<WhisperModelName, WhisperModelSpec> = {
  tiny: {
    file: 'ggml-tiny.bin',
    sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
    bytes: 77_691_713,
    url: `${REPO}/ggml-tiny.bin`,
  },
  base: {
    file: 'ggml-base.bin',
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    bytes: 147_951_465,
    url: `${REPO}/ggml-base.bin`,
  },
  small: {
    file: 'ggml-small.bin',
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
    bytes: 487_601_967,
    url: `${REPO}/ggml-small.bin`,
  },
};

export const DEFAULT_WHISPER_MODEL: WhisperModelName = 'base';

type Env = Record<string, string | undefined>;

/** Where models are cached: LECLAP_WHISPER_DIR, else $XDG_CACHE_HOME/leclap/whisper, else ~/.cache/leclap/whisper. */
export function whisperCacheDir(env: Env = process.env, home = os.homedir()): string {
  if (env.LECLAP_WHISPER_DIR) return env.LECLAP_WHISPER_DIR;

  return path.join(env.XDG_CACHE_HOME ?? path.join(home, '.cache'), 'leclap', 'whisper');
}

export interface EnsureModelOptions {
  /** Download the model when it is missing (the explicit opt-in). */
  download?: boolean;
  dir?: string;
  fetch?: typeof fetch;
  env?: Env;
  /** Model table (tests). */
  models?: Partial<Record<WhisperModelName, WhisperModelSpec>>;
  onProgress?: (received: number, total: number) => void;
  signal?: AbortSignal;
}

function isComplete(file: string, spec: WhisperModelSpec): boolean {
  try {
    return fs.statSync(file).size === spec.bytes;
  } catch {
    return false;
  }
}

function missing(name: string, spec: WhisperModelSpec, dir: string): Error {
  const megabytes = Math.round(spec.bytes / 1_000_000);

  return new Error(
    `whisper_model_missing: the whisper "${name}" model (${megabytes} MB) is not downloaded. Run again with ` +
      `--download-model (or set LECLAP_WHISPER_DOWNLOAD=1) to fetch it once from ${spec.url} into ${dir} ` +
      '(checksum-verified; your audio never leaves this machine), or point LECLAP_WHISPER_MODEL at a ggml model file.'
  );
}

async function download(spec: WhisperModelSpec, target: string, options: EnsureModelOptions): Promise<void> {
  const response = await (options.fetch ?? fetch)(spec.url, { signal: options.signal });

  if (!response.ok || !response.body) throw new Error(`model download failed: HTTP ${response.status} for ${spec.url}`);

  const partial = `${target}.part`;
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(partial);
  let received = 0;

  try {
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
      out.write(chunk);
      received += chunk.byteLength;
      options.onProgress?.(received, spec.bytes);
    }

    await new Promise<void>((resolve, reject) => {
      out.end((error?: Error | null) => {
        if (error) {
          reject(error);

          return;
        }

        resolve();
      });
    });

    const digest = hash.digest('hex');

    if (digest !== spec.sha256) {
      throw new Error(`model checksum mismatch for ${spec.file}: got ${digest}, expected ${spec.sha256}`);
    }

    fs.renameSync(partial, target);
  } finally {
    out.destroy();
    fs.rmSync(partial, { force: true });
  }
}

/** Path of a verified local model file; downloads it first only with the explicit opt-in. */
export async function ensureWhisperModel(name: WhisperModelName, options: EnsureModelOptions = {}): Promise<string> {
  const env = options.env ?? process.env;

  if (env.LECLAP_WHISPER_MODEL) return env.LECLAP_WHISPER_MODEL;

  const spec = (options.models ?? WHISPER_MODELS)[name];

  if (!spec) throw new Error(`unknown whisper model "${name}" (use tiny, base or small)`);

  const dir = options.dir ?? whisperCacheDir(env);
  const target = path.join(dir, spec.file);

  if (isComplete(target, spec)) return target;

  if (!(options.download || env.LECLAP_WHISPER_DOWNLOAD === '1')) throw missing(name, spec, dir);

  fs.mkdirSync(dir, { recursive: true });
  await download(spec, target, options);

  return target;
}
