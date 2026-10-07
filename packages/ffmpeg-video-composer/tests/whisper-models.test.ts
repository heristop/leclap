import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WHISPER_MODELS, ensureWhisperModel, whisperCacheDir } from '@/services/transcribe-node/whisper-models';

const BYTES = Buffer.from('a tiny stand-in for a ggml model');
const SHA = crypto.createHash('sha256').update(BYTES).digest('hex');
const TABLE = {
  tiny: { file: 'ggml-tiny.bin', sha256: SHA, bytes: BYTES.length, url: 'https://example.test/ggml-tiny.bin' },
};

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-models-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const fetchOf = (body: Buffer) => vi.fn(async () => new Response(new Uint8Array(body), { status: 200 }));

describe('whisper model table', () => {
  it('pins the official ggml checksums', () => {
    expect(WHISPER_MODELS.tiny.sha256).toBe('be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21');
    expect(WHISPER_MODELS.base.sha256).toBe('60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe');
    expect(WHISPER_MODELS.base.url).toBe('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin');
  });
});

describe('whisperCacheDir', () => {
  it('prefers LECLAP_WHISPER_DIR, then XDG_CACHE_HOME, then ~/.cache', () => {
    expect(whisperCacheDir({ LECLAP_WHISPER_DIR: '/models' }, '/home/me')).toBe('/models');
    expect(whisperCacheDir({ XDG_CACHE_HOME: '/xdg' }, '/home/me')).toBe(path.join('/xdg', 'leclap', 'whisper'));
    expect(whisperCacheDir({}, '/home/me')).toBe(path.join('/home/me', '.cache', 'leclap', 'whisper'));
  });
});

describe('ensureWhisperModel', () => {
  it('never downloads without an explicit opt-in', async () => {
    const fetch = fetchOf(BYTES);

    await expect(ensureWhisperModel('tiny', { dir, fetch, models: TABLE, env: {} })).rejects.toThrow(
      /whisper_model_missing.*--download-model/s
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('downloads once, verifies the checksum and reuses the cached file', async () => {
    const fetch = fetchOf(BYTES);
    const file = await ensureWhisperModel('tiny', { dir, fetch, models: TABLE, download: true, env: {} });

    expect(file).toBe(path.join(dir, 'ggml-tiny.bin'));
    expect(fs.readFileSync(file)).toEqual(BYTES);
    expect(await ensureWhisperModel('tiny', { dir, fetch, models: TABLE, env: {} })).toBe(file);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('honours LECLAP_WHISPER_DOWNLOAD=1 as the opt-in', async () => {
    const fetch = fetchOf(BYTES);

    await ensureWhisperModel('tiny', { dir, fetch, models: TABLE, env: { LECLAP_WHISPER_DOWNLOAD: '1' } });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses a download whose checksum does not match, leaving nothing behind', async () => {
    const fetch = fetchOf(Buffer.from('tampered bytes of the same model..'));

    await expect(ensureWhisperModel('tiny', { dir, fetch, models: TABLE, download: true, env: {} })).rejects.toThrow(
      /checksum/
    );
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('treats a truncated cached file as missing', async () => {
    fs.writeFileSync(path.join(dir, 'ggml-tiny.bin'), 'short');

    await expect(ensureWhisperModel('tiny', { dir, fetch: fetchOf(BYTES), models: TABLE, env: {} })).rejects.toThrow(
      /whisper_model_missing/
    );
  });

  it('uses LECLAP_WHISPER_MODEL as is', async () => {
    const own = path.join(dir, 'my-model.bin');
    fs.writeFileSync(own, 'x');

    expect(await ensureWhisperModel('base', { dir, env: { LECLAP_WHISPER_MODEL: own } })).toBe(own);
  });
});
