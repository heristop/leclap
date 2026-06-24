import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Controllable handler for the mocked `node:child_process` execFile.
 *
 * The Node adapters build their async helper with `promisify(execFile)` at module
 * load time. `execFile` runs the program directly (NO shell), following the Node
 * callback protocol `(file, args, options?, callback)` and resolving with
 * `{ stdout, stderr }`. We implement a mock `execFile` that honours that protocol,
 * records each `{ file, args }` invocation, and delegates to a swappable handler
 * so each test can drive success / failure per call. To keep the existing
 * string-oriented assertions readable, every recorded call is also flattened to a
 * display string (`file arg1 arg2 ...`) in `execCommands`.
 */
type ExecResolution = { stdout: string; stderr: string };
type ExecHandler = (command: string, file: string, args: string[]) => ExecResolution | Promise<ExecResolution>;

let execHandler: ExecHandler;
const execCommands: string[] = [];
const execFileCalls: Array<{ file: string; args: string[] }> = [];

vi.mock('node:child_process', () => {
  const execFile = (
    file: string,
    argsOrCallback?: unknown,
    optionsOrCallback?: unknown,
    maybeCallback?: (error: unknown, result?: ExecResolution) => void
  ) => {
    const args = Array.isArray(argsOrCallback) ? (argsOrCallback as string[]) : [];
    const command = [file, ...args].join(' ');
    execFileCalls.push({ file, args });
    execCommands.push(command);

    const callback = [argsOrCallback, optionsOrCallback, maybeCallback].find((c) => typeof c === 'function') as
      | ((error: unknown, result?: ExecResolution) => void)
      | undefined;

    Promise.resolve()
      .then(() => execHandler(command, file, args))
      .then(
        (result) => callback?.(null, result),
        (error) => callback?.(error)
      );

    // Return a stub ChildProcess-like object.
    return { pid: 1234 };
  };

  return { execFile, default: { execFile } };
});

// fs/promises is used by MusicNodeAdapter (unlink / rename of looped file).
const fsMocks = {
  unlink: vi.fn<(p: string) => Promise<void>>(),
  rename: vi.fn<(a: string, b: string) => Promise<void>>(),
};

vi.mock('node:fs/promises', () => ({
  default: {
    unlink: (p: string) => fsMocks.unlink(p),
    rename: (a: string, b: string) => fsMocks.rename(a, b),
  },
  unlink: (p: string) => fsMocks.unlink(p),
  rename: (a: string, b: string) => fsMocks.rename(a, b),
}));

// NOTE on the static adapter: it resolves its binaries with
// `createRequire(import.meta.url)('ffmpeg-static')`, which bypasses Vitest's
// module mocking entirely. We therefore exercise it against the *real*
// `ffmpeg-static` install (the binary path it returns) and assert on the
// structure of the spawned command rather than a hard-coded path. `ffmpeg`
// itself is still never executed because `node:child_process` is mocked above.

// @ffmpeg/ffmpeg + @ffmpeg/util for the WASM adapters.
interface FakeFFmpeg {
  load: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  createDir: ReturnType<typeof vi.fn>;
  listDir: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  __listeners: Record<string, Array<(data: unknown) => void>>;
  __emit: (event: string, data: unknown) => void;
}

let lastFFmpegInstance: FakeFFmpeg | null = null;
let ffmpegLoadShouldThrow = false;
let toBlobUrlShouldThrow = false;

function createFakeFFmpeg(): FakeFFmpeg {
  const listeners: Record<string, Array<(data: unknown) => void>> = {};

  const instance: FakeFFmpeg = {
    __listeners: listeners,
    __emit: (event: string, data: unknown) => {
      for (const cb of listeners[event] ?? []) {
        cb(data);
      }
    },
    on: vi.fn((event: string, cb: (data: unknown) => void) => {
      (listeners[event] ??= []).push(cb);
    }),
    off: vi.fn((event: string, cb: (data: unknown) => void) => {
      listeners[event] = (listeners[event] ?? []).filter((c) => c !== cb);
    }),
    load: vi.fn(async () => {
      if (ffmpegLoadShouldThrow) {
        throw new Error('load boom');
      }
    }),
    exec: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
    readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
    deleteFile: vi.fn(async () => undefined),
    createDir: vi.fn(async () => undefined),
    listDir: vi.fn(async () => [{ name: 'a.mp4', isDir: false }]),
  };

  return instance;
}

vi.mock('@ffmpeg/ffmpeg', () => ({
  // Must be constructable via `new FFmpeg()`, so use a function (not an arrow).
  FFmpeg: vi.fn().mockImplementation(function (this: FakeFFmpeg) {
    lastFFmpegInstance = createFakeFFmpeg();

    return lastFFmpegInstance;
  }),
}));

vi.mock('@ffmpeg/util', () => ({
  toBlobURL: vi.fn(async (url: string) => {
    if (toBlobUrlShouldThrow) {
      throw new Error('blob boom');
    }

    return `blob:${url}`;
  }),
}));

// ---------------------------------------------------------------------------
// Imports of subjects under test (after mocks are registered).
// ---------------------------------------------------------------------------
import FFmpegNodeAdapter from '@/platform/ffmpeg/FFmpegNodeAdapter';
import FFmpegStaticAdapter from '@/platform/ffmpeg/FFmpegStaticAdapter';
import FFmpegWasmAdapter from '@/platform/ffmpeg/FFmpegWasmAdapter';
import MusicNodeAdapter from '@/platform/ffmpeg/MusicNodeAdapter';
import AbstractFFmpeg from '@/platform/ffmpeg/AbstractFFmpeg';
import AbstractMusic from '@/platform/ffmpeg/AbstractMusic';
import type AbstractFilesystem from '@/platform/filesystem/AbstractFilesystem';
import type AbstractLogger from '@/platform/logging/AbstractLogger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function probeJson(streams: unknown[]): string {
  return JSON.stringify({ streams });
}

function makeLogger(): AbstractLogger & {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as AbstractLogger & {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
}

/** Minimal filesystem stub; override per test as needed. */
function makeFs(overrides: Partial<AbstractFilesystem> = {}): AbstractFilesystem {
  const base = {
    stat: vi.fn(async () => true),
    readFile: vi.fn(async () => new Uint8Array([9, 9, 9])),
    writeFile: vi.fn(async () => undefined),
    getBuildDir: vi.fn(() => '/build'),
  };

  return { ...base, ...overrides } as unknown as AbstractFilesystem;
}

beforeEach(() => {
  execCommands.length = 0;
  execFileCalls.length = 0;
  execHandler = () => ({ stdout: '', stderr: '' });
  fsMocks.unlink.mockReset();
  fsMocks.unlink.mockResolvedValue(undefined);
  fsMocks.rename.mockReset();
  fsMocks.rename.mockResolvedValue(undefined);
  lastFFmpegInstance = null;
  ffmpegLoadShouldThrow = false;
  toBlobUrlShouldThrow = false;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// Abstract base classes
// ===========================================================================
describe('Abstract base classes', () => {
  it('AbstractFFmpeg is an abstract constructor that concrete adapters extend', () => {
    expect(typeof AbstractFFmpeg).toBe('function');
    expect(new FFmpegNodeAdapter()).toBeInstanceOf(AbstractFFmpeg);
  });

  it('AbstractMusic can be subclassed and its process contract implemented', async () => {
    class TestMusic extends (AbstractMusic as unknown as { new (): object }) {
      process = async () => ({ rc: 0 });
    }

    const instance = new TestMusic() as unknown as AbstractMusic;
    await expect(instance.process(makeLogger(), makeFs(), 0, '/m.mp3')).resolves.toEqual({ rc: 0 });
  });
});

// ===========================================================================
// FFmpegNodeAdapter
// ===========================================================================
describe('FFmpegNodeAdapter', () => {
  it('execute() builds the ffmpeg command and returns rc 0 on success', async () => {
    const adapter = new FFmpegNodeAdapter();

    const result = await adapter.execute('-i in.mp4 out.mp4');

    expect(result).toEqual({ rc: 0 });
    expect(execCommands).toContain('ffmpeg -i in.mp4 out.mp4');
  });

  it('execute() throws an FFmpegError carrying stderr on failure', async () => {
    const adapter = new FFmpegNodeAdapter();
    execHandler = () => {
      throw Object.assign(new Error('exit 1'), { stderr: 'boom-stderr' });
    };

    await expect(adapter.execute('-i bad.mp4')).rejects.toThrow('FFmpeg command failed');
    await expect(adapter.execute('-i bad.mp4')).rejects.toThrow('boom-stderr');
  });

  it('getInfos() parses ffprobe JSON for video + audio streams', async () => {
    const adapter = new FFmpegNodeAdapter();
    execHandler = () => ({
      stdout: probeJson([
        { codec_type: 'video', codec_name: 'h264', duration: '12.5' },
        { codec_type: 'audio', codec_name: 'aac', duration: '12.5', sample_rate: '44100' },
      ]),
      stderr: '',
    });

    const infos = await adapter.getInfos('clip.mp4');

    expect(infos).toEqual({
      duration: 12.5,
      videoCodec: 'h264',
      audioCodec: 'aac',
      sampleRate: 44100,
    });
    expect(execFileCalls.some((c) => c.file === 'ffprobe')).toBe(true);
    expect(execFileCalls.some((c) => c.args.includes('clip.mp4'))).toBe(true);
  });

  it('getInfos() returns nulls when no streams are present', async () => {
    const adapter = new FFmpegNodeAdapter();
    execHandler = () => ({ stdout: probeJson([]), stderr: '' });

    const infos = await adapter.getInfos('empty.mp4');

    expect(infos).toEqual({
      duration: null,
      videoCodec: null,
      audioCodec: null,
      sampleRate: null,
    });
  });

  it('getInfos() handles audio-only files (no video stream, no sample_rate)', async () => {
    const adapter = new FFmpegNodeAdapter();
    execHandler = () => ({
      stdout: probeJson([{ codec_type: 'audio', codec_name: 'mp3', duration: '5.0' }]),
      stderr: '',
    });

    const infos = await adapter.getInfos('song.mp3');

    expect(infos.duration).toBeNull();
    expect(infos.videoCodec).toBeNull();
    expect(infos.audioCodec).toBe('mp3');
    expect(infos.sampleRate).toBeNull();
  });

  it('getInfos() throws an FFmpegError when ffprobe fails', async () => {
    const adapter = new FFmpegNodeAdapter();
    execHandler = () => {
      throw Object.assign(new Error('probe fail'), { stderr: 'probe-stderr' });
    };

    await expect(adapter.getInfos('missing.mp4')).rejects.toThrow('FFprobe analysis failed for missing.mp4');
  });
});

// ===========================================================================
// FFmpegStaticAdapter
// ===========================================================================
describe('FFmpegStaticAdapter', () => {
  it('execute() quotes the static binary path and forwards args, returning rc 0', async () => {
    const adapter = new FFmpegStaticAdapter();

    const result = await adapter.execute('-i a.mp4 b.mp4');

    expect(result).toEqual({ rc: 0 });
    // A single command was spawned via execFile: <...>ffmpeg with the args as an
    // argv array (no shell, so the binary path is NOT quoted).
    expect(execFileCalls).toHaveLength(1);
    expect(execFileCalls[0].file).toMatch(/ffmpeg$/);
    expect(execFileCalls[0].args).toEqual(['-i', 'a.mp4', 'b.mp4']);
  });

  it('execute() throws an FFmpegError (static) on failure', async () => {
    const adapter = new FFmpegStaticAdapter();
    execHandler = () => {
      throw Object.assign(new Error('exit 1'), { stderr: 'static-stderr' });
    };

    await expect(adapter.execute('-i x.mp4')).rejects.toThrow('FFmpeg command failed (static)');
    await expect(adapter.execute('-i x.mp4')).rejects.toThrow('static-stderr');
  });

  it('getInfos() runs the static ffprobe binary and parses streams', async () => {
    const adapter = new FFmpegStaticAdapter();
    execHandler = () => ({
      stdout: probeJson([
        { codec_type: 'video', codec_name: 'vp9', duration: '7.25' },
        { codec_type: 'audio', codec_name: 'opus', duration: '7.25', sample_rate: '48000' },
      ]),
      stderr: '',
    });

    const infos = await adapter.getInfos('movie.webm');

    expect(infos).toEqual({
      duration: 7.25,
      videoCodec: 'vp9',
      audioCodec: 'opus',
      sampleRate: 48000,
    });
    // ffprobe binary run via execFile, with the JSON-streams flags and raw source.
    expect(execFileCalls[0].file).toMatch(/ffprobe$/);
    expect(execFileCalls[0].args).toEqual(['-v', 'quiet', '-print_format', 'json', '-show_streams', 'movie.webm']);
  });

  it('getInfos() returns nulls when ffprobe reports no streams', async () => {
    const adapter = new FFmpegStaticAdapter();
    execHandler = () => ({ stdout: probeJson([]), stderr: '' });

    const infos = await adapter.getInfos('empty.webm');

    expect(infos).toEqual({
      duration: null,
      videoCodec: null,
      audioCodec: null,
      sampleRate: null,
    });
  });

  it('getInfos() throws an FFmpegError (static) on ffprobe failure', async () => {
    const adapter = new FFmpegStaticAdapter();
    execHandler = () => {
      throw Object.assign(new Error('probe fail'), { stderr: 'oops' });
    };

    await expect(adapter.getInfos('bad.webm')).rejects.toThrow('FFprobe analysis failed for bad.webm (static)');
  });

  it('derives the ffprobe path from the ffmpeg path when ffprobe-static is absent', async () => {
    // ffprobe-static is not installed in this repo, so the constructor's
    // catch-branch derives the ffprobe binary path from the ffmpeg one
    // (.../ffmpeg -> .../ffprobe). The spawned probe command must point at it.
    const adapter = new FFmpegStaticAdapter();
    execHandler = () => ({
      stdout: probeJson([{ codec_type: 'video', codec_name: 'h264', duration: '1.0' }]),
      stderr: '',
    });

    await adapter.getInfos('clip.mp4');

    expect(execFileCalls[0].file).toMatch(/ffprobe$/);
    // The probe path is the ffmpeg path with a trailing 'ffmpeg' swapped for 'ffprobe'.
    expect(execFileCalls[0].file).not.toMatch(/ffmpeg$/);
  });

  it('execute() throws when the ffmpeg binary path is unavailable', async () => {
    const adapter = new FFmpegStaticAdapter();
    // Simulate ffmpeg-static resolving to null (binary not bundled).
    (adapter as unknown as { ffmpegPath: string | null }).ffmpegPath = null;

    await expect(adapter.execute('-i a.mp4')).rejects.toThrow('FFmpeg static binary not available');
    // No command should have been spawned.
    expect(execCommands).toHaveLength(0);
  });

  it('getInfos() throws when the ffprobe binary path is unavailable', async () => {
    const adapter = new FFmpegStaticAdapter();
    (adapter as unknown as { ffprobePath: string | null }).ffprobePath = null;

    await expect(adapter.getInfos('a.mp4')).rejects.toThrow('FFprobe static binary not available');
    expect(execCommands).toHaveLength(0);
  });
});

// ===========================================================================
// FFmpegWasmAdapter
// ===========================================================================
describe('FFmpegWasmAdapter', () => {
  /** Construct the adapter and wait until its async init has loaded FFmpeg. */
  async function makeReadyWasm(fs: AbstractFilesystem = makeFs()): Promise<{
    adapter: FFmpegWasmAdapter;
    ffmpeg: FakeFFmpeg;
  }> {
    const adapter = new FFmpegWasmAdapter(fs);
    await adapter.waitForReady();
    expect(lastFFmpegInstance).not.toBeNull();

    return { adapter, ffmpeg: lastFFmpegInstance! };
  }

  it('initializes FFmpeg WASM, registers log/progress listeners and loads the core', async () => {
    const { ffmpeg } = await makeReadyWasm();

    expect(ffmpeg.load).toHaveBeenCalledTimes(1);
    const events = ffmpeg.on.mock.calls.map((c) => c[0]);
    expect(events).toContain('log');
    expect(events).toContain('progress');

    const loadArg = ffmpeg.load.mock.calls[0][0] as { coreURL: string; wasmURL: string };
    expect(loadArg.coreURL).toContain('blob:');
    expect(loadArg.wasmURL).toContain('blob:');
  });

  it('progress + log listeners run without throwing (covers default callbacks)', async () => {
    const { ffmpeg } = await makeReadyWasm();

    // Drive the listeners registered during init.
    expect(() => ffmpeg.__emit('log', { message: 'hello world' })).not.toThrow();
    expect(() => ffmpeg.__emit('progress', { progress: 0.5, time: 1000 })).not.toThrow();
    // progress === undefined branch -> pct 0
    expect(() => ffmpeg.__emit('progress', { time: 0 })).not.toThrow();
  });

  it('progress listener gets a clamped 0..1 fraction from elapsed time, not ffmpeg-core progress', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();
    const fractions: number[] = [];
    adapter.progressListener = (fraction: number) => fractions.push(fraction);
    adapter.expectedDurationSeconds = 10;

    // `time` is microseconds elapsed; ffmpeg-core's own `progress` ratio is garbage for inputs without a
    // known duration (huge negative), so it must be ignored.
    ffmpeg.__emit('progress', { time: 5_000_000 }); // 5s / 10s
    ffmpeg.__emit('progress', { time: 50_000_000 }); // past the end -> clamp to 1
    ffmpeg.__emit('progress', { progress: -626939, time: 6_000_000 }); // bogus progress ignored

    expect(fractions).toEqual([0.5, 1, 0.6]);
  });

  it('progress listener is not called without a positive expected duration', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();
    const fractions: number[] = [];
    adapter.progressListener = (fraction: number) => fractions.push(fraction);

    adapter.expectedDurationSeconds = undefined;
    ffmpeg.__emit('progress', { time: 6_000_000 });
    adapter.expectedDurationSeconds = 0;
    ffmpeg.__emit('progress', { time: 6_000_000 });

    expect(fractions).toEqual([]);
  });

  it('waitForReady() resolves immediately once loaded', async () => {
    const { adapter } = await makeReadyWasm();
    await expect(adapter.waitForReady()).resolves.toBeUndefined();
  });

  it('execute() parses the command, runs exec and returns rc 0', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();

    const result = await adapter.execute('-i "my input.mp4" -c:v libx264 out.mp4');

    expect(result).toEqual({ rc: 0 });
    expect(ffmpeg.exec).toHaveBeenCalledWith(['-i', 'my input.mp4', '-c:v', 'libx264', 'out.mp4']);
  });

  it('execute() surfaces a failed command (no output produced) as an FFmpegError', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();

    // A genuine failure: ffmpeg logs an error and writes no output file, so
    // reading the output back from MEMFS throws. Output-presence is the reliable
    // failure signal (ffmpeg-core logs "Aborted()" even on a successful exit, so
    // scanning the log for errors/aborts would mis-fire on every real compile).
    ffmpeg.exec.mockImplementationOnce(() => {
      ffmpeg.__emit('log', { message: 'Error: invalid data found' });
    });
    ffmpeg.readFile.mockRejectedValueOnce(new Error('FS error: no such file'));

    await expect(adapter.execute('-i bad.mp4 out.mp4')).rejects.toThrow('FFmpeg WASM execution failed');
  });

  it('execute() does not treat "Aborted()" log noise as a failure when output is produced', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();

    // ffmpeg-core emits "Aborted()" even on a normal exit. With the output file
    // present in MEMFS (the fake readFile returns data), this must still succeed
    // - this guards the fix that got all templates compiling in WASM.
    ffmpeg.exec.mockImplementationOnce(() => {
      ffmpeg.__emit('log', { message: 'Aborted()' });
    });

    await expect(adapter.execute('-i in.mp4 out.mp4')).resolves.toEqual({ rc: 0 });
  });

  it('execute() ignores informational/version log lines (no false failure)', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();
    ffmpeg.exec.mockImplementationOnce(() => {
      ffmpeg.__emit('log', { message: 'ffmpeg version 6.0' });
      ffmpeg.__emit('log', { message: 'configuration: --enable-gpl' });
      ffmpeg.__emit('log', { message: 'frame= 100' });
      ffmpeg.__emit('log', {}); // no message -> ignored branch
    });

    await expect(adapter.execute('-i ok.mp4 out.mp4')).resolves.toEqual({ rc: 0 });
  });

  it('execute() wraps exec rejections in an FFmpegError', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();
    ffmpeg.exec.mockRejectedValueOnce(new Error('exec exploded'));

    await expect(adapter.execute('-i x.mp4')).rejects.toThrow('FFmpeg WebAssembly command failed');
  });

  it('getInfos() loads the source into MEMFS and parses Duration/Video/Audio from logs', async () => {
    const fs = makeFs({
      stat: vi.fn(async () => true) as unknown as AbstractFilesystem['stat'],
      readFile: vi.fn(async () => new Uint8Array([4, 5, 6])) as unknown as AbstractFilesystem['readFile'],
    });
    const { adapter, ffmpeg } = await makeReadyWasm(fs);

    ffmpeg.exec.mockImplementationOnce(() => {
      ffmpeg.__emit('log', { message: '  Duration: 00:01:30.50, start: 0.0' });
      ffmpeg.__emit('log', { message: '  Stream #0:0: Video: h264 (High), yuv420p' });
      ffmpeg.__emit('log', { message: '  Stream #0:1: Audio: aac (LC), 48000 Hz' });
      ffmpeg.__emit('log', {}); // message undefined branch
    });

    const infos = await adapter.getInfos('media/clip.mp4');

    expect(infos.duration).toBeCloseTo(90.5, 2);
    expect(infos.videoCodec).toBe('h264 (High)');
    expect(infos.audioCodec).toBe('aac (LC)');
    expect(infos.sampleRate).toBeNull();
    // File was written to MEMFS under its basename.
    expect(ffmpeg.writeFile).toHaveBeenCalledWith('clip.mp4', expect.any(Uint8Array));
    expect(ffmpeg.exec).toHaveBeenCalledWith(['-i', 'clip.mp4']);
  });

  it('getInfos() warns and skips MEMFS load when the file is not on disk', async () => {
    const fs = makeFs({
      stat: vi.fn(async () => false) as unknown as AbstractFilesystem['stat'],
    });
    const { adapter, ffmpeg } = await makeReadyWasm(fs);

    const infos = await adapter.getInfos('absent.mp4');

    expect(ffmpeg.writeFile).not.toHaveBeenCalled();
    expect(infos.duration).toBeNull();
  });

  it('getInfos() swallows filesystem read errors during MEMFS load', async () => {
    const fs = makeFs({
      stat: vi.fn(async () => true) as unknown as AbstractFilesystem['stat'],
      readFile: vi.fn(async () => {
        throw new Error('disk read failed');
      }) as unknown as AbstractFilesystem['readFile'],
    });
    const { adapter, ffmpeg } = await makeReadyWasm(fs);

    // Should not throw despite readFile failing inside loadSourceFileToMemfs.
    const infos = await adapter.getInfos('clip.mp4');
    expect(infos).toBeDefined();
    expect(ffmpeg.writeFile).not.toHaveBeenCalled();
  });

  it('getInfos() wraps thrown errors in an FFmpegError', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();
    ffmpeg.exec.mockRejectedValueOnce(new Error('probe blew up'));

    await expect(adapter.getInfos('clip.mp4')).rejects.toThrow('FFmpeg WebAssembly analysis failed for clip.mp4');
  });

  it('getInfos() uses "Unknown error" stderr when a non-Error is thrown', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();
    // Reject with a NON-Error value so the catch's `instanceof Error` is false
    // and the FFmpegError is constructed with the 'Unknown error' fallback.
    ffmpeg.exec.mockRejectedValueOnce('plain probe failure');

    const error = await adapter.getInfos('clip.mp4').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    // FFmpegError appends its stderr (here 'Unknown error') to the message.
    expect((error as Error).message).toContain('FFmpeg WebAssembly analysis failed for clip.mp4');
    expect((error as Error).message).toContain('Unknown error');
  });

  it('execute() parses commands with double and trailing spaces without empty args', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();

    // Double space between tokens exercises the space-handler's `if (current.trim())`
    // FALSE branch; the trailing space exercises the final-flush FALSE branch.
    const result = await adapter.execute('-i  in.mp4  out.mp4 ');

    expect(result).toEqual({ rc: 0 });
    expect(ffmpeg.exec).toHaveBeenCalledWith(['-i', 'in.mp4', 'out.mp4']);
  });

  it('getInfos() handles a source with no slash (basename === source)', async () => {
    const fs = makeFs({ stat: vi.fn(async () => false) as unknown as AbstractFilesystem['stat'] });
    const { adapter, ffmpeg } = await makeReadyWasm(fs);

    await adapter.getInfos('plain.mp4');
    expect(ffmpeg.exec).toHaveBeenCalledWith(['-i', 'plain.mp4']);
  });

  it('writeFile/readFile round-trip through the underlying FFmpeg instance', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();
    const payload = new Uint8Array([7, 8, 9]);
    ffmpeg.readFile.mockResolvedValueOnce(payload);

    await adapter.writeFile('out.bin', payload);
    expect(ffmpeg.writeFile).toHaveBeenCalledWith('out.bin', payload);

    const read = await adapter.readFile('out.bin');
    expect(ffmpeg.readFile).toHaveBeenCalledWith('out.bin');
    expect(read).toEqual(payload);
  });

  it('deleteFile and listDir delegate to the underlying FFmpeg instance', async () => {
    const { adapter, ffmpeg } = await makeReadyWasm();

    await adapter.deleteFile('gone.bin');
    expect(ffmpeg.deleteFile).toHaveBeenCalledWith('gone.bin');

    const list = await adapter.listDir('/');
    expect(ffmpeg.listDir).toHaveBeenCalledWith('/');
    expect(list).toEqual([{ name: 'a.mp4', isDir: false }]);
  });

  it('throws an FFmpegError when methods are used before WASM is loaded', async () => {
    // load() throws -> isLoaded stays false -> getFFmpeg() guards every method.
    ffmpegLoadShouldThrow = true;
    const adapter = new FFmpegWasmAdapter(makeFs());

    // Give the (rejected) init microtask a chance to settle.
    await Promise.resolve();

    await expect(adapter.writeFile('x', new Uint8Array())).rejects.toThrow('FFmpeg WebAssembly not loaded');
    await expect(adapter.readFile('x')).rejects.toThrow('FFmpeg WebAssembly not loaded');
    await expect(adapter.deleteFile('x')).rejects.toThrow('FFmpeg WebAssembly not loaded');
    await expect(adapter.listDir('/')).rejects.toThrow('FFmpeg WebAssembly not loaded');
    await expect(adapter.getInfos('x')).rejects.toThrow();
  });

  it('waitForReady() rejects with a timeout when FFmpeg never loads', async () => {
    vi.useFakeTimers();
    try {
      ffmpegLoadShouldThrow = true;
      const adapter = new FFmpegWasmAdapter(makeFs());
      await Promise.resolve(); // let init reject

      const pending = adapter.waitForReady();
      const assertion = expect(pending).rejects.toThrow('Timeout waiting for FFmpeg WebAssembly to load');

      // Advance beyond the 30s max wait, flushing the chained poll timers.
      await vi.advanceTimersByTimeAsync(31000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

// ===========================================================================
// MusicNodeAdapter
// ===========================================================================
describe('MusicNodeAdapter', () => {
  it('process() returns rc 0 and does not loop when music already covers the length', async () => {
    const adapter = new MusicNodeAdapter();
    const logger = makeLogger();
    execHandler = () => ({ stdout: '120.0\n', stderr: '' });

    const result = await adapter.process(logger, makeFs(), 60, '/music.mp3');

    expect(result).toEqual({ rc: 0 });
    expect(logger.info).toHaveBeenCalledWith('[Music] Duration: 120 / 60');
    // Only the ffprobe duration call ran; no looping ffmpeg command.
    expect(execCommands.every((c) => !c.includes('-acodec copy'))).toBe(true);
    expect(fsMocks.rename).not.toHaveBeenCalled();
  });

  it('process() loops the music when it is shorter than the total length', async () => {
    const adapter = new MusicNodeAdapter();
    const logger = makeLogger();
    // music = 10s, total = 35s -> needs 4 repetitions (concat with 3 extra '|').
    execHandler = (command) => {
      if (command.includes('-acodec copy')) {
        return { stdout: '', stderr: '' };
      }

      return { stdout: '10\n', stderr: '' };
    };

    const result = await adapter.process(logger, makeFs(), 35, '/music.mp3');

    expect(result).toEqual({ rc: 0 });
    const loopCmd = execCommands.find((c) => c.includes('-acodec copy'));
    expect(loopCmd).toBeDefined();
    // 4 occurrences of the music path inside the concat input.
    expect(loopCmd!.match(/\/music\.mp3/g)!.length).toBe(4);
    expect(fsMocks.unlink).toHaveBeenCalledWith('/music.mp3');
    expect(fsMocks.rename).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('[Music][Loop] ffmpeg process completed');
  });

  it('process() throws when ffprobe returns a non-numeric duration', async () => {
    const adapter = new MusicNodeAdapter();
    const logger = makeLogger();
    execHandler = () => ({ stdout: 'not-a-number\n', stderr: '' });

    await expect(adapter.process(logger, makeFs(), 60, '/music.mp3')).rejects.toThrow(/Failed to get media duration/);
    expect(logger.error).toHaveBeenCalled();
  });

  it('getMediaDuration throws "Invalid duration" then wraps it as a media-duration failure', async () => {
    const adapter = new MusicNodeAdapter();
    const logger = makeLogger();
    // parseFloat('not-a-number') -> NaN -> isNaN branch throws
    // 'Invalid duration value returned by ffprobe', wrapped by the outer catch.
    execHandler = () => ({ stdout: 'not-a-number\n', stderr: '' });

    const error = await adapter.process(logger, makeFs(), 60, '/music.mp3').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('Failed to get media duration');
    expect((error as Error).message).toContain('Invalid duration value returned by ffprobe');
  });

  it('process() throws when the build directory is not set', async () => {
    const adapter = new MusicNodeAdapter();
    const logger = makeLogger();
    execHandler = () => ({ stdout: '5\n', stderr: '' });
    const fs = makeFs({ getBuildDir: vi.fn(() => undefined) as unknown as AbstractFilesystem['getBuildDir'] });

    await expect(adapter.process(logger, fs, 60, '/music.mp3')).rejects.toThrow('Build directory is not set');
    expect(logger.error).toHaveBeenCalledWith('[Music] Error: Build directory is not set');
  });

  it('process() rethrows when the loop ffmpeg command fails', async () => {
    const adapter = new MusicNodeAdapter();
    const logger = makeLogger();
    execHandler = (command) => {
      if (command.includes('-acodec copy')) {
        throw Object.assign(new Error('loop failed'), { stderr: 'loop-stderr' });
      }

      return { stdout: '5\n', stderr: '' };
    };

    await expect(adapter.process(logger, makeFs(), 60, '/music.mp3')).rejects.toThrow(/Failed command:/);
  });

  it('process() rethrows non-Error throwables and logs an unknown error', async () => {
    const adapter = new MusicNodeAdapter();
    const logger = makeLogger();
    // getMediaDuration wraps errors, so to hit the non-Error branch we make
    // getBuildDir throw a non-Error after a valid (short) duration.
    execHandler = () => ({ stdout: '5\n', stderr: '' });
    const fs = makeFs({
      getBuildDir: vi.fn(() => {
        throw 'string-explosion';
      }) as unknown as AbstractFilesystem['getBuildDir'],
    });

    await expect(adapter.process(logger, fs, 60, '/music.mp3')).rejects.toBe('string-explosion');
    expect(logger.error).toHaveBeenCalledWith('[Music] Unknown error occurred');
  });
});
