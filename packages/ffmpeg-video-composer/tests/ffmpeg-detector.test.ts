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

  describe('getInstallationInstructions', () => {
    it('should return installation instructions', () => {
      const instructions = FFmpegDetector.getInstallationInstructions();
      expect(instructions).toContain('To install FFmpeg');
      expect(instructions).toContain('npm install ffmpeg-static');
    });
  });
});
