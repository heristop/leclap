import { describe, expect, it } from 'vitest';
import { buildVideoInputArgs, firstConcatEntry } from '@/editor/video-input';

describe('video-input', () => {
  it('builds a plain file input', () => {
    expect(buildVideoInputArgs({ kind: 'file', path: '/b/v.mp4' })).toBe('-i /b/v.mp4');
  });

  it('builds a concat demuxer input with the standard flags', () => {
    expect(buildVideoInputArgs({ kind: 'concat', listPath: '/b/segments.list' })).toBe(
      '-f concat -safe 0 -auto_convert 1 -i /b/segments.list'
    );
  });

  it('extracts the first quoted concat entry', () => {
    const list = ["file '/b/intro_output.mp4'", "file '/b/clip_output.mp4'"].join('\n');
    expect(firstConcatEntry(list)).toBe('/b/intro_output.mp4');
  });

  it('handles an unquoted entry and an empty list', () => {
    expect(firstConcatEntry('file /b/a.mp4')).toBe('/b/a.mp4');
    expect(firstConcatEntry('')).toBeNull();
  });
});
