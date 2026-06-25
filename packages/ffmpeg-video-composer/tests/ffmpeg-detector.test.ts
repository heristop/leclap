import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { FFmpegDetector, FFmpegAvailability } from '@/platform/ffmpeg/FFmpegDetector';

describe('FFmpegDetector', () => {
  describe('detect', () => {
    it('should detect some FFmpeg implementation or return none', async () => {
      const result = await FFmpegDetector.detect();

      // Should return one of the valid availability states
      expect(Object.values(FFmpegAvailability)).toContain(result.availability);

      // If FFmpeg is available, should have version info
      if (result.availability === FFmpegAvailability.NONE) {
        expect(result.error).toBeDefined();

        return;
      }

      expect(result.version).toBeDefined();
      expect(result.path).toBeDefined();
    });
  });

  describe('environment detection', () => {
    it('should correctly identify Node.js environment', () => {
      expect(FFmpegDetector.isNodeEnvironment()).toBe(true);
    });

    it('should correctly identify non-browser environment', () => {
      expect(FFmpegDetector.isBrowserEnvironment()).toBe(false);
    });

    it('should correctly identify non-React Native environment', () => {
      expect(FFmpegDetector.isReactNativeEnvironment()).toBe(false);
    });
  });

  describe('parseEncoders', () => {
    it('extracts encoder names from `ffmpeg -encoders` output', () => {
      const sample = [
        'Encoders:',
        ' V..... = Video',
        ' ------',
        ' V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC',
        ' V....D h264_videotoolbox    VideoToolbox H.264 Encoder',
        ' A..... aac                  AAC (Advanced Audio Coding)',
      ].join('\n');

      const encoders = FFmpegDetector.parseEncoders(sample);

      expect(encoders).toContain('libx264');
      expect(encoders).toContain('h264_videotoolbox');
      expect(encoders).toContain('aac');
      // header / separator lines are not encoders
      expect(encoders).not.toContain('=');
      expect(encoders).not.toContain('Encoders:');
    });

    it('returns an empty array for empty output', () => {
      expect(FFmpegDetector.parseEncoders('')).toEqual([]);
    });
  });

  describe('listEncoders', () => {
    it('returns a non-empty encoder list from the available ffmpeg (libx264 present)', async () => {
      const encoders = await FFmpegDetector.listEncoders();
      expect(Array.isArray(encoders)).toBe(true);
      expect(encoders).toContain('libx264');
    });
  });

  describe('getInstallationInstructions', () => {
    it('should return installation instructions', () => {
      const instructions = FFmpegDetector.getInstallationInstructions();
      expect(instructions).toContain('To install FFmpeg');
      expect(instructions).toContain('npm install ffmpeg-static');
    });
  });
});
