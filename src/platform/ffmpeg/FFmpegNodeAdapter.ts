import { exec } from 'node:child_process';
import { injectable } from 'tsyringe';
import { promisify } from 'node:util';
import { FFMpegInfos } from '@/core/types';
import AbstractFFmpeg from './AbstractFFmpeg';

const execAsync = promisify(exec);

interface FFProbeStream {
  codec_type: string;
  codec_name: string | null;
  duration: string;
  sample_rate?: string;
}

interface FFProbeData {
  streams: FFProbeStream[];
}

@injectable()
class FFmpegNodeAdapter extends AbstractFFmpeg {
  /**
   * Execute a FFmpeg command
   * @param command - FFmpeg command to execute
   * @returns Promise with process result
   * @throws Error if FFmpeg command fails
   */
  execute = async (command: string): Promise<{ rc: number }> => {
    try {
      await execAsync(`ffmpeg ${command}`);
      return { rc: 0 };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`FFmpeg command failed: ${error.message}`);
      }
      throw new Error('Unknown error during FFmpeg execution');
    }
  };

  /**
   * Get media file information using FFprobe
   * @param source - Path to the media file
   * @returns Promise with media file information
   * @throws Error if FFprobe analysis fails
   */
  getInfos = async (source: string): Promise<FFMpegInfos> => {
    try {
      console.log(`[FFmpegNodeAdapter] Getting info for file: ${source}`);

      // Execute ffprobe with JSON output format
      const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_streams "${source}"`);

      const info: FFProbeData = JSON.parse(stdout);

      const videoStream = info.streams.find((s) => s.codec_type === 'video');
      const audioStream = info.streams.find((s) => s.codec_type === 'audio');

      console.log(`[FFmpegNodeAdapter] File info:`, {
        videoFound: !!videoStream,
        audioFound: !!audioStream,
        duration: videoStream ? parseFloat(videoStream.duration) : null,
        videoCodec: videoStream?.codec_name || null,
      });

      return {
        duration: videoStream ? parseFloat(videoStream.duration) : null,
        videoCodec: videoStream?.codec_name || null,
        audioCodec: audioStream?.codec_name || null,
        sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : null,
      };
    } catch (error) {
      console.error(`[FFmpegNodeAdapter] Error analyzing file ${source}:`, error);
      if (error instanceof Error) {
        if (error instanceof SyntaxError) {
          throw new Error(`Failed to parse FFprobe output: ${error.message}`);
        }
        throw new Error(`FFprobe analysis failed: ${error.message}`);
      }
      throw new Error('Unknown error during FFprobe analysis');
    }
  };
}

export default FFmpegNodeAdapter;
