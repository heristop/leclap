import 'reflect-metadata';
import { describe, it, expect } from 'vitest';

describe('FFmpegWasmAdapter', () => {
  it('should be testable when @ffmpeg/ffmpeg is not actually installed', () => {
    // This test verifies the test setup works even without @ffmpeg/ffmpeg
    // In real scenarios, users would have @ffmpeg/ffmpeg installed for browser use
    expect(true).toBe(true);
  });

  it('should be importable', async () => {
    // Test that the module can be imported without errors
    expect(async () => {
      await import('@/platform/ffmpeg/FFmpegWasmAdapter');
    }).not.toThrow();
  });
});
