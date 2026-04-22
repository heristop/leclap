import { inject, injectable } from 'tsyringe';
import type { FFMpegInfos } from '@/core/types';
import AbstractFFmpeg from './AbstractFFmpeg';
import { FFmpegError } from '@/core/errors/FFmpegError';
import AbstractFilesystem from '../filesystem/AbstractFilesystem';

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
  listDir(path: string): Promise<FSNode[]>;
  on(event: string, callback: (data: { message?: string; progress?: number; time?: number }) => void): void;
  off(event: string, callback: (data: { message?: string; progress?: number; time?: number }) => void): void;
}

@injectable()
class FFmpegWasmAdapter extends AbstractFFmpeg {
  private ffmpeg: FFmpegWasm | null = null;
  private isLoaded = false;

  constructor(@inject(AbstractFilesystem) private fs: AbstractFilesystem) {
    super();
    this.initializeFFmpeg();
  }

  private async initializeFFmpeg(): Promise<void> {
    try {
      // Dynamically import FFmpeg WebAssembly
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');

      this.ffmpeg = new FFmpeg() as FFmpegWasm;

      // Set up logging
      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpegWasm]', message);
      });

      this.ffmpeg.on('progress', ({ progress, time }) => {
        console.log('[FFmpegWasm] Progress:', Math.round(progress * 100), '% | Time:', time);
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

  private ensureLoaded(): void {
    if (!this.ffmpeg || !this.isLoaded) {
      throw new FFmpegError('FFmpeg WebAssembly not loaded. Call await ffmpeg.load() first.');
    }
  }

  /**
   * Wait for FFmpeg WebAssembly to be ready
   * @returns Promise that resolves when FFmpeg is loaded
   */
  waitForReady = async (): Promise<void> => {
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (!this.isLoaded) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new FFmpegError('Timeout waiting for FFmpeg WebAssembly to load');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  /**
   * Execute a FFmpeg command using WebAssembly
   * @param command - FFmpeg command to execute (without 'ffmpeg' prefix)
   * @returns Promise with process result
   * @throws Error if FFmpeg command fails
   */
  execute = async (command: string): Promise<{ rc: number }> => {
    await this.waitForReady();
    this.ensureLoaded();

    let hasError = false;
    let errorMessage = '';

    // Track errors and aborts
    const errorCallback = ({ message }: { message?: string }) => {
      if (message) {
        // Only log actual errors, not informational output
        const isError = message.toLowerCase().includes('error') &&
          !message.includes('ffmpeg version') &&
          !message.includes('configuration:');
        const isAbort = message.includes('Aborted()') || message.includes('abort');

        if (isError || isAbort) {
          console.error('[FFmpegWasm Error]', message);
          hasError = true;
          errorMessage = message;
        }
      }
    };

    this.ffmpeg!.on('log', errorCallback);

    try {
      // Parse command string into arguments array
      const args = this.parseCommand(command);
      console.log('[FFmpegWasmAdapter] Executing command with args:', args);

      await this.ffmpeg!.exec(args);

      this.ffmpeg!.off('log', errorCallback);

      if (hasError) {
        throw new FFmpegError(
          'FFmpeg WASM execution failed',
          errorMessage || 'Process aborted'
        );
      }

      return { rc: 0 };
    } catch (error) {
      this.ffmpeg!.off('log', errorCallback);
      throw new FFmpegError(
        'FFmpeg WebAssembly command failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  /**
   * Get media file information using FFmpeg WebAssembly
   * @param source - Path or file data to analyze
   * @returns Promise with media file information
   * @throws Error if analysis fails
   */
  getInfos = async (source: string): Promise<FFMpegInfos> => {
    this.ensureLoaded();

    try {
      console.log(`[FFmpegWasmAdapter] Getting info for file: ${source}`);

      // Ensure file exists in MEMFS
      const filename = source.split('/').pop()!;
      try {
        // Try to read from MEMFS to check existence
        // Note: readFile throws if file doesn't exist in some versions, or we can use listDir
        // But simplest is to try to read from FS adapter and write to MEMFS if needed
        // However, if it's already in MEMFS (e.g. intermediate file), we might overwrite it?
        // Usually getInfos is called on source files.

        // Let's try to read from the filesystem adapter first
        // If the file is in IndexedDB (BrowserFilesystem), we need to load it into MEMFS
        if (await this.fs.stat(source)) {
          const data = await this.fs.readFile(source);
          await this.ffmpeg!.writeFile(filename, data);
          console.log(`[FFmpegWasmAdapter] Loaded ${filename} from filesystem to MEMFS`);
        } else {
          console.warn(`[FFmpegWasmAdapter] File ${source} not found in filesystem, assuming it's already in MEMFS or will fail`);
        }
      } catch (e) {
        console.warn(`[FFmpegWasmAdapter] Failed to load file from filesystem: ${e instanceof Error ? e.message : String(e)}`);
      }

      let duration: number | null = null;
      let videoCodec: string | null = null;
      let audioCodec: string | null = null;

      const logCallback = ({ message }: { message: string }) => {
        // Parse Duration
        const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (durationMatch) {
          const hours = parseFloat(durationMatch[1]);
          const minutes = parseFloat(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }

        // Parse Video Stream
        if (message.includes('Video:')) {
          const videoMatch = message.match(/Video: ([^,]+)/);
          if (videoMatch) {
            videoCodec = videoMatch[1].trim();
          }
        }

        // Parse Audio Stream
        if (message.includes('Audio:')) {
          const audioMatch = message.match(/Audio: ([^,]+)/);
          if (audioMatch) {
            audioCodec = audioMatch[1].trim();
          }
        }
      };

      this.ffmpeg!.on('log', logCallback);

      // Run ffmpeg -i to get file info
      // Use the filename in MEMFS
      await this.ffmpeg!.exec(['-i', filename]);

      this.ffmpeg!.off('log', logCallback);

      console.log(`[FFmpegWasmAdapter] File info retrieved: Duration=${duration}, Video=${videoCodec}, Audio=${audioCodec}`);

      return {
        duration,
        videoCodec,
        audioCodec,
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
    // Basic command parsing - handles quoted arguments and spaces
    const args: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ' ' && !inQuotes) {
        if (current.trim()) {
          args.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * Write a file to FFmpeg WebAssembly filesystem
   * @param name - File name
   * @param data - File data
   */
  writeFile = async (name: string, data: Uint8Array): Promise<void> => {
    this.ensureLoaded();
    await this.ffmpeg!.writeFile(name, data);
  };

  /**
   * Read a file from FFmpeg WebAssembly filesystem
   * @param name - File name
   * @returns File data
   */
  readFile = async (name: string): Promise<Uint8Array> => {
    this.ensureLoaded();
    return await this.ffmpeg!.readFile(name);
  };

  /**
   * Delete a file from FFmpeg WebAssembly filesystem
   * @param name - File name
   */
  deleteFile = async (name: string): Promise<void> => {
    this.ensureLoaded();
    await this.ffmpeg!.deleteFile(name);
  };

  /**
   * List files in FFmpeg WebAssembly filesystem
   * @param path - Directory path
   * @returns Array of file/directory entries
   */
  listDir = async (path: string): Promise<FSNode[]> => {
    this.ensureLoaded();
    return await this.ffmpeg!.listDir(path);
  };
}

export default FFmpegWasmAdapter;
