import { inject, injectable } from 'tsyringe';
import type { FFMpegInfos } from '@/core/types';
import AbstractFFmpeg, { type FSNode, type VirtualFilesystemFFmpeg } from './AbstractFFmpeg';
import { parseCommand } from './parseCommand';
import { FFmpegError } from '../../core/errors/FFmpegError';
import type AbstractFilesystem from '../filesystem/AbstractFilesystem';

export type { FSNode };

interface FFmpegWasm {
  load(config?: { coreURL: string; wasmURL: string }): Promise<void>;
  exec(args: string[]): Promise<void>;
  writeFile(name: string, data: Uint8Array): Promise<void>;
  readFile(name: string): Promise<Uint8Array>;
  deleteFile(name: string): Promise<void>;
  createDir(path: string): Promise<void>;
  listDir(path: string): Promise<FSNode[]>;
  on(event: string, callback: (data: { message?: string; progress?: number; time?: number }) => void): void;
  off(event: string, callback: (data: { message?: string; progress?: number; time?: number }) => void): void;
}

type FFmpegLogData = { message?: string; progress?: number; time?: number };

@injectable()
class FFmpegWasmAdapter extends AbstractFFmpeg implements VirtualFilesystemFFmpeg {
  readonly usesVirtualFilesystem = true;
  private ffmpeg: FFmpegWasm | null = null;
  private isLoaded = false;

  constructor(@inject('filesystemAdapter') private readonly fs: AbstractFilesystem) {
    super();
    this.initializeFFmpeg().catch((error: unknown) => {
      console.error(
        '[FFmpegWasmAdapter] Initialization failed:',
        error instanceof Error ? error.message : String(error)
      );
    });
  }

  private async initializeFFmpeg(): Promise<void> {
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');

      this.ffmpeg = new FFmpeg() as unknown as FFmpegWasm;

      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpegWasm]', message);
      });

      this.ffmpeg.on('progress', ({ progress, time }) => {
        const pct = progress === undefined ? 0 : Math.round(progress * 100);
        console.log('[FFmpegWasm] Progress:', pct, '% | Time:', time);
        this.progressListener?.(progress ?? 0);
      });

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize FFmpeg WebAssembly: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private getFFmpeg(): FFmpegWasm {
    if (!this.ffmpeg || !this.isLoaded) {
      throw new FFmpegError('FFmpeg WebAssembly not loaded. Call await ffmpeg.load() first.');
    }

    return this.ffmpeg;
  }

  waitForReady = (): Promise<void> => {
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    const poll = (): Promise<void> => {
      if (this.isLoaded) {
        return Promise.resolve();
      }

      if (Date.now() - startTime > maxWaitTime) {
        return Promise.reject(new FFmpegError('Timeout waiting for FFmpeg WebAssembly to load'));
      }

      return new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      }).then(poll);
    };

    return poll();
  };

  execute = async (command: string): Promise<{ rc: number }> => {
    await this.waitForReady();
    const ffmpeg = this.getFFmpeg();

    const errorMessages: string[] = [];

    const errorCallback = ({ message }: FFmpegLogData) => {
      if (message) {
        const isError =
          message.toLowerCase().includes('error') &&
          !message.includes('ffmpeg version') &&
          !message.includes('configuration:');
        const isAbort = message.includes('Aborted()') || message.includes('abort');

        if (isError || isAbort) {
          console.error('[FFmpegWasm Error]', message);
          errorMessages.push(message);
        }
      }
    };

    ffmpeg.on('log', errorCallback);

    try {
      const args = parseCommand(command);

      // The filesystem adapter (this.fs) and ffmpeg's MEMFS are separate stores.
      // Copy every input file the command references into MEMFS at the same path
      // before running, otherwise ffmpeg aborts with "No such file or directory".
      await this.bridgeInputsToMemfs(ffmpeg, args);

      // Ensure the output's parent directory exists in MEMFS so ffmpeg can write
      // a full-path output (e.g. /tmp/build/<segment>_output.mp4).
      const outputPath = FFmpegWasmAdapter.resolveOutputPath(args);

      if (outputPath !== undefined) {
        await this.ensureMemfsDir(ffmpeg, outputPath);
      }

      await ffmpeg.exec(args);

      ffmpeg.off('log', errorCallback);

      // Copy the produced output back out of MEMFS into the filesystem adapter
      // so the rest of the compilation pipeline can read it. ffmpeg-core logs
      // "Aborted()" even on a normal exit, so success is decided by whether the
      // output file was actually produced - not by scanning the logs.
      const produced = await this.bridgeOutputFromMemfs(ffmpeg, args);

      // Fail only when the command was supposed to produce an output file but
      // didn't. Commands with no output arg (e.g. `-version`, used by form
      // segments) are not failures, and ffmpeg-core logs "Aborted()" even on a
      // normal exit - so the log alone is not a reliable failure signal.
      if (outputPath !== undefined && !produced) {
        throw new FFmpegError('FFmpeg WASM execution failed', errorMessages[0] ?? 'No output produced');
      }

      return { rc: 0 };
    } catch (error) {
      ffmpeg.off('log', errorCallback);

      throw new FFmpegError(
        'FFmpeg WebAssembly command failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  /**
   * Collect every file path the command references that must exist in MEMFS:
   * the `-i` inputs plus any absolute `/tmp/...` path embedded in another arg
   * (e.g. a drawtext `fontfile=/tmp/build/fonts/X.ttf` inside -filter_complex).
   */
  private static collectReferencedPaths(args: string[]): string[] {
    const paths = new Set<string>();

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-i' && i + 1 < args.length) {
        paths.add(args[i + 1] ?? '');
      }

      const embedded = arg.match(/\/tmp\/[^\s'":,]+/g);

      if (embedded) {
        for (const match of embedded) {
          paths.add(match);
        }
      }
    }

    return [...paths].filter(Boolean);
  }

  /**
   * For a concat-demuxer command (`-f concat -i <list>`), read the list from the filesystem adapter
   * and return the segment file paths it references (`file '<path>'` lines). These are not present
   * in the command args, so without this they never reach MEMFS and the concat aborts.
   */
  private async collectConcatSegmentPaths(args: string[]): Promise<string[]> {
    const formatIndex = args.indexOf('-f');

    if (formatIndex === -1 || args[formatIndex + 1] !== 'concat') {
      return [];
    }

    const inputIndex = args.indexOf('-i', formatIndex);
    const listPath = inputIndex === -1 ? undefined : args[inputIndex + 1];

    if (listPath === undefined) {
      return [];
    }

    try {
      if (!(await this.fs.stat(listPath))) {
        return [];
      }

      return FFmpegWasmAdapter.parseConcatList(await this.fs.read(listPath));
    } catch (error) {
      console.warn(
        `[FFmpegWasmAdapter] Could not read concat list ${listPath}: ${error instanceof Error ? error.message : String(error)}`
      );

      return [];
    }
  }

  /**
   * Parse a concat-demuxer list into the segment file paths it references. Lines look like
   * `file '/tmp/build/intro_output.mp4'` (quoted) or `file /tmp/build/intro_output.mp4`; other
   * directives (comments, `duration`, blanks) are ignored.
   */
  static parseConcatList(content: string): string[] {
    return content
      .split('\n')
      .map((line) => line.match(/^\s*file\s+'?(.+?)'?\s*$/)?.[1]?.trim())
      .filter((path): path is string => Boolean(path));
  }

  /**
   * The output file is the final positional argument of an FFmpeg command.
   */
  private static resolveOutputPath(args: string[]): string | undefined {
    const last = args.at(-1);

    return last !== undefined && !last.startsWith('-') ? last : undefined;
  }

  /**
   * Recursively create the parent directories of a file path inside MEMFS.
   */
  private async ensureMemfsDir(ffmpeg: FFmpegWasm, filePath: string): Promise<void> {
    const segments = filePath.split('/').slice(0, -1).filter(Boolean);

    // Create each prefix sequentially (parent before child); ignore "already exists".
    await segments.reduce<Promise<void>>(
      (chain, _segment, index) =>
        chain.then(async () => {
          const dir = `/${segments.slice(0, index + 1).join('/')}`;

          try {
            await ffmpeg.createDir(dir);
          } catch {
            // Directory already exists - nothing to do.
          }
        }),
      Promise.resolve()
    );
  }

  /**
   * Mirror every input file referenced by the command from the filesystem
   * adapter into ffmpeg's MEMFS at the same path.
   */
  private async bridgeInputsToMemfs(ffmpeg: FFmpegWasm, args: string[]): Promise<void> {
    const direct = FFmpegWasmAdapter.collectReferencedPaths(args);
    // A `-f concat -i list.txt` command only names the list in its args; the segment files the
    // list points at must also be mirrored into MEMFS or the concat demuxer aborts. This is what
    // makes multi-section templates (intro + clip + outro) render in the browser, not just
    // single-section ones.
    const concatSegments = await this.collectConcatSegmentPaths(args);
    const inputs = [...new Set([...direct, ...concatSegments])];

    await Promise.all(
      inputs.map(async (input) => {
        try {
          if (!(await this.fs.stat(input))) {
            return;
          }

          await this.ensureMemfsDir(ffmpeg, input);
          await ffmpeg.writeFile(input, await this.fs.readFile(input));
        } catch (error) {
          console.warn(
            `[FFmpegWasmAdapter] Could not bridge input ${input}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
    );
  }

  /**
   * Mirror the command's output file from MEMFS back into the filesystem adapter.
   * Returns true when an output file was actually produced and copied.
   */
  private async bridgeOutputFromMemfs(ffmpeg: FFmpegWasm, args: string[]): Promise<boolean> {
    const output = FFmpegWasmAdapter.resolveOutputPath(args);

    if (output === undefined) {
      return false;
    }

    try {
      const data = await ffmpeg.readFile(output);
      await this.fs.writeFile(output, data);

      return true;
    } catch {
      // Output not present in MEMFS (e.g. a probe-only command, or a failure).
      return false;
    }
  }

  private async loadSourceFileToMemfs(ffmpeg: FFmpegWasm, source: string, filename: string): Promise<void> {
    try {
      const fileExists = await this.fs.stat(source);

      if (!fileExists) {
        return;
      }

      const data = await this.fs.readFile(source);
      await ffmpeg.writeFile(filename, data);
    } catch (error) {
      console.warn(
        `[FFmpegWasmAdapter] Failed to load file from filesystem: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseMediaInfoFromLog(
    state: { duration: number | null; videoCodec: string | null; audioCodec: string | null },
    message: string
  ): void {
    // Parse Duration
    const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);

    if (durationMatch) {
      const hours = parseFloat(durationMatch[1]);
      const minutes = parseFloat(durationMatch[2]);
      const seconds = parseFloat(durationMatch[3]);
      state.duration = hours * 3600 + minutes * 60 + seconds;
    }

    // Parse Video Stream
    if (message.includes('Video:')) {
      const videoMatch = message.match(/Video: ([^,]+)/);

      if (videoMatch) {
        state.videoCodec = videoMatch[1].trim();
      }
    }

    if (message.includes('Audio:')) {
      const audioMatch = message.match(/Audio: ([^,]+)/);

      if (audioMatch) {
        state.audioCodec = audioMatch[1].trim();
      }
    }
  }

  getInfos = async (source: string): Promise<FFMpegInfos> => {
    const ffmpeg = this.getFFmpeg();

    try {
      const filename = source.split('/').pop() ?? source;

      await this.loadSourceFileToMemfs(ffmpeg, source, filename);

      const state = {
        duration: null as number | null,
        videoCodec: null as string | null,
        audioCodec: null as string | null,
      };

      const logCallback = ({ message }: FFmpegLogData) => {
        if (message) {
          this.parseMediaInfoFromLog(state, message);
        }
      };

      ffmpeg.on('log', logCallback);

      await ffmpeg.exec(['-i', filename]);

      ffmpeg.off('log', logCallback);

      return {
        duration: state.duration,
        videoCodec: state.videoCodec,
        audioCodec: state.audioCodec,
        sampleRate: null,
      };
    } catch (error) {
      throw new FFmpegError(
        `FFmpeg WebAssembly analysis failed for ${source}`,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  writeFile = async (name: string, data: Uint8Array): Promise<void> => {
    const ffmpeg = this.getFFmpeg();
    await ffmpeg.writeFile(name, data);
  };

  readFile = async (name: string): Promise<Uint8Array> => {
    const ffmpeg = this.getFFmpeg();

    return await ffmpeg.readFile(name);
  };

  deleteFile = async (name: string): Promise<void> => {
    const ffmpeg = this.getFFmpeg();
    await ffmpeg.deleteFile(name);
  };

  listDir = async (path: string): Promise<FSNode[]> => {
    const ffmpeg = this.getFFmpeg();

    return await ffmpeg.listDir(path);
  };
}

export default FFmpegWasmAdapter;
