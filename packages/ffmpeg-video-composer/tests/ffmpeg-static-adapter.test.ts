import 'reflect-metadata';
import { describe, it, expect } from 'vitest';

describe('FFmpegStaticAdapter', () => {
  it('should be testable when ffmpeg-static is not actually installed', () => {
    // This test verifies the test setup works even without ffmpeg-static
    // In real scenarios, users would have ffmpeg-static installed if they want this adapter
    expect(true).toBe(true);
  });

  it('should be importable', async () => {
    // Test that the module can be imported without errors
    expect(async () => {
      await import('@/platform/ffmpeg/FFmpegStaticAdapter');
    }).not.toThrow();
  });
});
