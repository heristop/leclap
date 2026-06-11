import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Security regression suite for the Node-side FFmpeg adapters.
 *
 * The adapters MUST run ffmpeg/ffprobe through `execFile` (no shell), passing an
 * argv array so that shell metacharacters in template-derived strings become
 * literal arguments instead of being interpreted by a shell. We mock
 * `node:child_process` exposing `execFile` only: the adapters build their async
 * helper with `promisify(execFile)`, so our mock follows the Node callback
 * protocol `(file, args, options?, callback)` and records every invocation.
 */
type ExecFileResolution = { stdout: string; stderr: string };
type ExecFileHandler = (file: string, args: string[]) => ExecFileResolution | Promise<ExecFileResolution>;

interface ExecFileCall {
  file: string;
  args: string[];
}

let execFileHandler: ExecFileHandler;
const execFileCalls: ExecFileCall[] = [];

vi.mock('node:child_process', () => {
  const execFile = (
    file: string,
    argsOrCallback?: unknown,
    optionsOrCallback?: unknown,
    maybeCallback?: (error: unknown, result?: ExecFileResolution) => void
  ) => {
    const args = Array.isArray(argsOrCallback) ? (argsOrCallback as string[]) : [];
    execFileCalls.push({ file, args });

    const callback = [argsOrCallback, optionsOrCallback, maybeCallback].find((c) => typeof c === 'function') as
      | ((error: unknown, result?: ExecFileResolution) => void)
      | undefined;

    Promise.resolve()
      .then(() => execFileHandler(file, args))
      .then(
        (result) => callback?.(null, result),
        (error) => callback?.(error)
      );

    return { pid: 1234 };
  };

  return { execFile, default: { execFile } };
});

import FFmpegNodeAdapter from '@/platform/ffmpeg/FFmpegNodeAdapter';

beforeEach(() => {
  execFileCalls.length = 0;
  execFileHandler = () => ({ stdout: '', stderr: '' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FFmpegNodeAdapter — shell injection hardening', () => {
  it('runs ffmpeg via execFile with an argv array (no shell string)', async () => {
    const adapter = new FFmpegNodeAdapter();

    await adapter.execute('-i in.mp4 out.mp4');

    expect(execFileCalls).toHaveLength(1);
    expect(execFileCalls[0].file).toBe('ffmpeg');
    expect(Array.isArray(execFileCalls[0].args)).toBe(true);
    expect(execFileCalls[0].args).toEqual(['-i', 'in.mp4', 'out.mp4']);
  });

  it('keeps a shell-metacharacter payload as a single literal argv element', async () => {
    const adapter = new FFmpegNodeAdapter();
    // A malicious template value that, under a shell, would run `touch /tmp/pwned`.
    const payload = '$(touch /tmp/pwned)';

    await adapter.execute(`-i "${payload}" out.mp4`);

    expect(execFileCalls).toHaveLength(1);
    expect(execFileCalls[0].file).toBe('ffmpeg');
    // The payload survives as ONE literal element — never split, never shell-expanded.
    expect(execFileCalls[0].args).toContain(payload);
    expect(execFileCalls[0].args).toEqual(['-i', payload, 'out.mp4']);
  });

  it('preserves a drawtext filtergraph as a single literal argv element', async () => {
    const adapter = new FFmpegNodeAdapter();

    await adapter.execute('-vf "drawtext=text=\'Hi\':x=10" out.mp4');

    expect(execFileCalls[0].file).toBe('ffmpeg');
    expect(execFileCalls[0].args).toEqual(['-vf', "drawtext=text='Hi':x=10", 'out.mp4']);
  });

  it('runs ffprobe via execFile with an argv array including the raw source path', async () => {
    const adapter = new FFmpegNodeAdapter();
    execFileHandler = () => ({
      stdout: JSON.stringify({ streams: [{ codec_type: 'video', codec_name: 'h264', duration: '3.0' }] }),
      stderr: '',
    });

    const source = '$(rm -rf /).mp4';
    const infos = await adapter.getInfos(source);

    expect(infos.duration).toBe(3);
    expect(execFileCalls).toHaveLength(1);
    expect(execFileCalls[0].file).toBe('ffprobe');
    expect(execFileCalls[0].args).toEqual(['-v', 'quiet', '-print_format', 'json', '-show_streams', source]);
  });
});
