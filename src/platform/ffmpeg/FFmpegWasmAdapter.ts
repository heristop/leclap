import { injectable } from 'tsyringe';
import { FFMpegInfos } from '@/core/types';
import AbstractFFmpeg from './AbstractFFmpeg';
import { FFmpegError } from '@/core/errors/FFmpegError';

interface FFmpegWasm {
  load(config?: { coreURL: string; wasmURL: string }): Promise<void>;
  exec(args: string[]): Promise<void>;
  writeFile(name: string, data: Uint8Array): Promise<void>;
  readFile(name: string): Promise<Uint8Array>;
  deleteFile(name: string): Promise<void>;
  listDir(path: string): Promise<string[]>;
  on(event: string, callback: (data: { message?: string; progress?: number; time?: number }) => void): void;
  off(event: string, callback: (data: { message?: string; progress?: number; time?: number }) => void): void;
}

@injectable()
class FFmpegWasmAdapter extends AbstractFFmpeg {
  private ffmpeg: FFmpegWasm | null = null;
  private isLoaded = false;

  constructor() {
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
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.15/dist/esm';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      console.log('[FFmpegWasmAdapter] FFmpeg WebAssembly loaded successfully');
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
   * Execute a FFmpeg command using WebAssembly
   * @param command - FFmpeg command to execute (without 'ffmpeg' prefix)
   * @returns Promise with process result
   * @throws Error if FFmpeg command fails
   */
  execute = async (command: string): Promise<{ rc: number }> => {
    this.ensureLoaded();

    try {
      // Parse command string into arguments array
      const args = this.parseCommand(command);
      console.log('[FFmpegWasmAdapter] Executing command with args:', args);

      await this.ffmpeg!.exec(args);
      return { rc: 0 };
    } catch (error) {
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

      // For WebAssembly, we need to work with files in memory
      // This is a simplified implementation - in practice, you'd need to
      // load the file data into the FFmpeg filesystem first
      const tempName = `input_${Date.now()}.mp4`;

      // Execute ffprobe equivalent command
      await this.ffmpeg!.exec(['-i', tempName, '-v', 'quiet', '-print_format', 'json', '-show_streams', '-']);

      // For now, return basic info - in a real implementation,
      // you'd parse the JSON output from FFmpeg
      console.log(`[FFmpegWasmAdapter] File info retrieved`);

      return {
        duration: null, // Would be parsed from FFmpeg output
        videoCodec: null,
        audioCodec: null,
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
    // Simple command parsing - could be improved with proper shell parsing
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
}

export default FFmpegWasmAdapter;
