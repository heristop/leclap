import { inject, injectable } from 'tsyringe';
import type { FFMpegInfos } from '@/core/types';
import AbstractFFmpeg from './AbstractFFmpeg';
import { FFmpegError } from '../../core/errors/FFmpegError';
import type AbstractFilesystem from '../filesystem/AbstractFilesystem';

export interface FSNode {
  name: string;
  isDir: boolean;
}

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
class FFmpegWasmAdapter extends AbstractFFmpeg {
  private ffmpeg: FFmpegWasm | null = null;
  private isLoaded = false;

  constructor(@inject('filesystemAdapter') private readonly fs: AbstractFilesystem) {
    super();
    this.initializeFFmpeg().catch((error: unknown) => {
      console.error('[FFmpegWasmAdapter] Initialization failed:', error instanceof Error ? error.message : String(error));
    });
  }

  private async initializeFFmpeg(): Promise<void> {
    try {
      // Dynamically import FFmpeg WebAssembly
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');

      this.ffmpeg = new FFmpeg() as unknown as FFmpegWasm;

      // Set up logging
      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpegWasm]', message);
      });

      this.ffmpeg.on('progress', ({ progress, time }) => {
        const pct = progress === undefined ? 0 : Math.round(progress * 100);
        console.log('[FFmpegWasm] Progress:', pct, '% | Time:', time);
        this.progressListener?.(progress ?? 0);
      });

      // Load FFmpeg WebAssembly files
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      console.log('[FFmpegWasmAdapter] FFmpeg WebAssembly loaded');
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

  /**
   * Wait for FFmpeg WebAssembly to be ready
   * @returns Promise that resolves when FFmpeg is loaded
   */
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

      return new Promise<void>(resolve => {
        setTimeout(resolve, 100);
      }).then(poll);
    };

    return poll();
  };

  /**
   * Execute a FFmpeg command using WebAssembly
   * @param command - FFmpeg command to execute (without 'ffmpeg' prefix)
   * @returns Promise with process result
   * @throws Error if FFmpeg command fails
   */
  execute = async (command: string): Promise<{ rc: number }> => {
    await this.waitForReady();
    const ffmpeg = this.getFFmpeg();

    // Collect error messages from log callbacks
    const errorMessages: string[] = [];

    // Track errors and aborts
    const errorCallback = ({ message }: FFmpegLogData) => {
      if (message) {
        // Only log actual errors, not informational output
        const isError = message.toLowerCase().includes('error') &&
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
      // Parse command string into arguments array
      const args = this.parseCommand(command);
      console.log('[FFmpegWasmAdapter] Executing command with args:', args);

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
        throw new FFmpegError(
          'FFmpeg WASM execution failed',
          errorMessages[0] ?? 'No output produced'
        );
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
    await Promise.all(
      FFmpegWasmAdapter.collectReferencedPaths(args).map(async (input) => {
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

  /**
   * Load source file into MEMFS if it exists in the filesystem adapter
   */
  private async loadSourceFileToMemfs(ffmpeg: FFmpegWasm, source: string, filename: string): Promise<void> {
    try {
      const fileExists = await this.fs.stat(source);

      if (!fileExists) {
        console.warn(`[FFmpegWasmAdapter] File ${source} not found in filesystem, assuming it's already in MEMFS or will fail`);

        return;
      }

      const data = await this.fs.readFile(source);
      await ffmpeg.writeFile(filename, data);
      console.log(`[FFmpegWasmAdapter] Loaded ${filename} from filesystem to MEMFS`);
    } catch (error) {
      console.warn(`[FFmpegWasmAdapter] Failed to load file from filesystem: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse FFmpeg log messages to extract media info
   */
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
        state.videoCodec = (videoMatch[1]).trim();
      }
    }

    // Parse Audio Stream
    if (message.includes('Audio:')) {
      const audioMatch = message.match(/Audio: ([^,]+)/);

      if (audioMatch) {
        state.audioCodec = (audioMatch[1]).trim();
      }
    }
  }

  /**
   * Get media file information using FFmpeg WebAssembly
   * @param source - Path or file data to analyze
   * @returns Promise with media file information
   * @throws Error if analysis fails
   */
  getInfos = async (source: string): Promise<FFMpegInfos> => {
    const ffmpeg = this.getFFmpeg();

    try {
      console.log(`[FFmpegWasmAdapter] Getting info for file: ${source}`);

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

      // Run ffmpeg -i to get file info
      // Use the filename in MEMFS
      await ffmpeg.exec(['-i', filename]);

      ffmpeg.off('log', logCallback);

      console.log(`[FFmpegWasmAdapter] File info retrieved: Duration=${state.duration}, Video=${state.videoCodec}, Audio=${state.audioCodec}`);

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

  /**
   * Parse command string into arguments array
   * @param command - Command string
   * @returns Array of command arguments
   */
  private parseCommand(command: string): string[] {
    // Split a command string into args, honouring quotes. Tracks the actual
    // quote character so a different quote inside a quoted span (e.g. a single
    // quote inside a double-quoted -filter_complex) is kept literal - which the
    // FFmpeg filtergraph needs for values like text='Hello World'.
    const args: string[] = [];
    let current = '';
    let quoteChar: string | null = null;
    const flush = (): void => {
      if (current.trim()) { args.push(current.trim()); }
      current = '';
    };

    for (const char of command) {
      if (quoteChar !== null) {
        if (char === quoteChar) { quoteChar = null; continue; }
        current += char;
        continue;
      }

      if (char === '"' || char === "'") { quoteChar = char; continue; }

      if (char === ' ') { flush(); continue; }

      current += char;
    }

    flush();

    return args;
  }

  /**
   * Write a file to FFmpeg WebAssembly filesystem
   * @param name - File name
   * @param data - File data
   */
  writeFile = async (name: string, data: Uint8Array): Promise<void> => {
    const ffmpeg = this.getFFmpeg();
    await ffmpeg.writeFile(name, data);
  };

  /**
   * Read a file from FFmpeg WebAssembly filesystem
   * @param name - File name
   * @returns File data
   */
  readFile = async (name: string): Promise<Uint8Array> => {
    const ffmpeg = this.getFFmpeg();

    return await ffmpeg.readFile(name);
  };

  /**
   * Delete a file from FFmpeg WebAssembly filesystem
   * @param name - File name
   */
  deleteFile = async (name: string): Promise<void> => {
    const ffmpeg = this.getFFmpeg();
    await ffmpeg.deleteFile(name);
  };

  /**
   * List files in FFmpeg WebAssembly filesystem
   * @param path - Directory path
   * @returns Array of file/directory entries
   */
  listDir = async (path: string): Promise<FSNode[]> => {
    const ffmpeg = this.getFFmpeg();

    return await ffmpeg.listDir(path);
  };
}

export default FFmpegWasmAdapter;
