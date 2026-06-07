import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import FFmpegWasmAdapter from '@/platform/ffmpeg/FFmpegWasmAdapter';

// Minimal in-memory stand-in for the BrowserFilesystemAdapter (this.fs).
function makeFakeFs(initial: Record<string, Uint8Array>) {
  const files = new Map<string, Uint8Array>(Object.entries(initial));

  return {
    files,
    stat: (p: string) => Promise.resolve(files.has(p)),
    readFile: (p: string) => Promise.resolve(files.get(p) ?? new Uint8Array()),
    writeFile: (p: string, d: Uint8Array) => {
      files.set(p, d);

      return Promise.resolve();
    },
  };
}

// Minimal stand-in for the @ffmpeg/ffmpeg instance + its private MEMFS.
function makeFakeFfmpeg() {
  const memfs = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  let logCb: ((data: { message?: string }) => void) | undefined;

  return {
    memfs,
    dirs,
    exec: (args: string[]) => {
      // Simulate ffmpeg producing the output file (last positional arg) in MEMFS.
      const out = args.at(-1);

      if (out && !out.startsWith('-')) {
        memfs.set(out, new Uint8Array([9, 9, 9]));
      }

      // ffmpeg-core logs "Aborted()" even after a SUCCESSFUL run - success must
      // be judged by output presence, not by this log line.
      logCb?.({ message: 'frame=150 Lsize=1913kB time=00:00:05.01' });
      logCb?.({ message: 'Aborted()' });

      return Promise.resolve();
    },
    writeFile: (name: string, data: Uint8Array) => {
      memfs.set(name, data);

      return Promise.resolve();
    },
    readFile: (name: string) =>
      memfs.has(name) ? Promise.resolve(memfs.get(name)) : Promise.reject(new Error(`ENOENT ${name}`)),
    deleteFile: () => Promise.resolve(),
    listDir: () => Promise.resolve([]),
    createDir: (path: string) => {
      dirs.add(path);

      return Promise.resolve();
    },
    on: (event: string, cb: (data: { message?: string }) => void) => {
      if (event === 'log') {
        logCb = cb;
      }
    },
    off: () => {
      logCb = undefined;
    },
  };
}

describe('FFmpegWasmAdapter FS bridge', () => {
  it('writes -i input files into MEMFS at their full path and reads the output back to the filesystem', async () => {
    const inputBytes = new Uint8Array([1, 2, 3, 4]);
    const fontBytes = new Uint8Array([5, 6, 7]);
    const fakeFs = makeFakeFs({
      '/tmp/video_1.mp4': inputBytes,
      '/tmp/build/fonts/Rubik.ttf': fontBytes,
    });
    const adapter: any = new FFmpegWasmAdapter(fakeFs as never);
    const fakeFfmpeg = makeFakeFfmpeg();
    adapter.ffmpeg = fakeFfmpeg;
    adapter.isLoaded = true;

    await adapter.execute(
      '-y -i /tmp/video_1.mp4 -filter_complex drawtext=text=Hi:fontfile=/tmp/build/fonts/Rubik.ttf -map 0:a /tmp/build/video_1_output.mp4'
    );

    // The uploaded input must be bridged into ffmpeg's MEMFS at the exact path
    // the command references (the bug: it was never written, causing
    // "/tmp/video_1.mp4: No such file or directory").
    expect(fakeFfmpeg.memfs.get('/tmp/video_1.mp4')).toEqual(inputBytes);
    // Files referenced inside the filter graph (e.g. drawtext fontfile=) must
    // also be bridged - not just -i inputs ("No font filename provided").
    expect(fakeFfmpeg.memfs.get('/tmp/build/fonts/Rubik.ttf')).toEqual(fontBytes);
    expect(fakeFfmpeg.dirs.has('/tmp/build/fonts')).toBe(true);
    // The input's parent directory must be created in MEMFS first.
    expect(fakeFfmpeg.dirs.has('/tmp')).toBe(true);
    // The OUTPUT's parent directory must also exist in MEMFS so ffmpeg can write
    // a full-path output (e.g. /tmp/build/...).
    expect(fakeFfmpeg.dirs.has('/tmp/build')).toBe(true);
    // The produced output must be bridged back into the filesystem adapter.
    expect(fakeFs.files.get('/tmp/build/video_1_output.mp4')).toEqual(new Uint8Array([9, 9, 9]));
  });

  it('keeps a double-quoted filter_complex (with inner single quotes + spaces) as one argument', async () => {
    const fakeFs = makeFakeFs({ '/tmp/v.mp4': new Uint8Array([1, 2]) });
    const adapter: any = new FFmpegWasmAdapter(fakeFs as never);
    const fakeFfmpeg = makeFakeFfmpeg();
    adapter.ffmpeg = fakeFfmpeg;
    adapter.isLoaded = true;

    let execArgs: string[] = [];
    const originalExec = fakeFfmpeg.exec;
    fakeFfmpeg.exec = (args: string[]) => {
      execArgs = args;

      return originalExec(args);
    };

    // The drawtext text "Al Mo" contains a space; the whole graph is wrapped in
    // double quotes while text/fontfile use single quotes. The single quotes
    // (which ffmpeg's filtergraph needs) must survive, and the space must NOT
    // split the argument.
    await adapter.execute(
      `-y -i /tmp/v.mp4 -filter_complex "drawtext=text='Al Mo':fontfile='/tmp/f.ttf'" /tmp/out.mp4`
    );

    const fc = execArgs[execArgs.indexOf('-filter_complex') + 1];
    expect(fc).toBe("drawtext=text='Al Mo':fontfile='/tmp/f.ttf'");
  });

  it('does not fail a no-output command (e.g. -version used by form segments)', async () => {
    const fakeFs = makeFakeFs({});
    const adapter: any = new FFmpegWasmAdapter(fakeFs as never);
    const fakeFfmpeg = makeFakeFfmpeg();
    adapter.ffmpeg = fakeFfmpeg;
    adapter.isLoaded = true;

    // -version produces no output and ffmpeg-core logs "Aborted()" on exit; this
    // must NOT be treated as a compilation failure.
    const result = await adapter.execute('-version');

    expect(result).toEqual({ rc: 0 });
  });
});
