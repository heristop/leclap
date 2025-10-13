import 'reflect-metadata';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import PlatformBridge from '@/platform/PlatformBridge';
import FFmpegNodeAdapter from '@/platform/ffmpeg/FFmpegNodeAdapter';
import FFmpegStaticAdapter from '@/platform/ffmpeg/FFmpegStaticAdapter';
import FFmpegWasmAdapter from '@/platform/ffmpeg/FFmpegWasmAdapter';
import MusicNodeAdapter from '@/platform/ffmpeg/MusicNodeAdapter';
import FilesystemNodeAdapter from '@/platform/filesystem/FilesystemNodeAdapter';
import { FFmpegDetector, FFmpegAvailability } from '@/platform/ffmpeg/FFmpegDetector';

// Mock the FFmpegDetector to avoid depending on actual FFmpeg installation
vi.mock('@/platform/ffmpeg/FFmpegDetector');

describe('PlatformBridge', () => {
  let platformBridge: PlatformBridge;

  beforeEach(() => {
    platformBridge = new PlatformBridge();
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create an FFmpegNodeAdapter when system ffmpeg is available', async () => {
      // Mock system FFmpeg detection
      vi.mocked(FFmpegDetector.detect).mockResolvedValue({
        availability: FFmpegAvailability.SYSTEM,
        version: '8.0',
        path: 'system',
      });

      const adapter = await platformBridge.create('ffmpeg');
      expect(adapter).toBeInstanceOf(FFmpegNodeAdapter);
    });

    it('should create an FFmpegStaticAdapter when only static ffmpeg is available', async () => {
      // Mock static FFmpeg detection
      vi.mocked(FFmpegDetector.detect).mockResolvedValue({
        availability: FFmpegAvailability.STATIC,
        version: '6.0',
        path: '/path/to/static/ffmpeg',
      });

      const adapter = await platformBridge.create('ffmpeg');
      expect(adapter).toBeInstanceOf(FFmpegStaticAdapter);
    });

    it('should create an FFmpegWasmAdapter when only WebAssembly ffmpeg is available', async () => {
      // Mock WebAssembly FFmpeg detection
      vi.mocked(FFmpegDetector.detect).mockResolvedValue({
        availability: FFmpegAvailability.WASM,
        version: '0.12.x (WebAssembly)',
        path: 'wasm',
      });

      const adapter = await platformBridge.create('ffmpeg');
      expect(adapter).toBeInstanceOf(FFmpegWasmAdapter);
    });

    it('should throw an error when no ffmpeg implementation is available', async () => {
      // Mock no FFmpeg available
      vi.mocked(FFmpegDetector.detect).mockResolvedValue({
        availability: FFmpegAvailability.NONE,
        error: 'No FFmpeg found',
      });

      await expect(platformBridge.create('ffmpeg')).rejects.toThrow('No FFmpeg implementation available');
    });

    it('should create a FilesystemNodeAdapter when filesystem adapter is requested', async () => {
      const adapter = await platformBridge.create('filesystem');
      expect(adapter).toBeInstanceOf(FilesystemNodeAdapter);
    });

    it('should create a MusicNodeAdapter when music adapter is requested', async () => {
      const adapter = await platformBridge.create('music');
      expect(adapter).toBeInstanceOf(MusicNodeAdapter);
    });

    it('should throw a TypeError for an unknown adapter', async () => {
      await expect(platformBridge.create('unknown')).rejects.toThrow(TypeError);
    });
  });

  describe('isNodeEnvironment', () => {
    it('should return true in a Node environment', () => {
      // This test assumes it is run in a Node environment
      expect(platformBridge.isNodeEnvironment()).toBe(true);
    });
  });
});
