import { describe, expect, it } from 'vitest';
import { selectVideoCodec } from '@/platform/ffmpeg/select-video-codec';

describe('selectVideoCodec', () => {
  it('prefers videotoolbox on darwin when available', () => {
    expect(selectVideoCodec(['libx264', 'h264_videotoolbox'], 'darwin')).toBe('h264_videotoolbox');
  });

  it('prefers mediacodec on android when available', () => {
    expect(selectVideoCodec(['libx264', 'h264_mediacodec'], 'android')).toBe('h264_mediacodec');
  });

  it('falls back to the libx264 default ("") when no hw encoder is present', () => {
    expect(selectVideoCodec(['libx264'], 'darwin')).toBe('');
  });

  it('ignores a hw encoder that does not match the platform', () => {
    expect(selectVideoCodec(['h264_videotoolbox'], 'linux')).toBe('');
    expect(selectVideoCodec(['h264_mediacodec'], 'darwin')).toBe('');
  });

  it('returns "" for an empty encoder list', () => {
    expect(selectVideoCodec([], 'darwin')).toBe('');
  });
});
