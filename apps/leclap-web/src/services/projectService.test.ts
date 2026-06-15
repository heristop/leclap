import { describe, it, expect } from 'vitest';
import { diffClips } from './projectService';
import type { StoredClip } from '@/lib/projectModel';

const clip = (over: Partial<StoredClip> = {}): StoredClip => ({
  blobKey: 'blob-1',
  name: 'a.mp4',
  type: 'video/mp4',
  size: 100,
  ...over,
});

const file = (name: string, size: number): File => {
  const f = new File([new Uint8Array(size)], name, { type: 'video/mp4' });

  return f;
};

describe('diffClips', () => {
  it('writes a brand-new clip and prunes nothing', () => {
    expect(diffClips({}, { v1: file('a.mp4', 10) })).toEqual({ write: ['v1'], prune: [] });
  });

  it('skips an unchanged clip (same name + size)', () => {
    const prev = { v1: clip({ name: 'a.mp4', size: 10 }) };
    expect(diffClips(prev, { v1: file('a.mp4', 10) })).toEqual({ write: [], prune: [] });
  });

  it('rewrites and prunes a replaced clip', () => {
    const prev = { v1: clip({ blobKey: 'old', name: 'a.mp4', size: 10 }) };
    expect(diffClips(prev, { v1: file('b.mp4', 20) })).toEqual({ write: ['v1'], prune: ['old'] });
  });

  it('prunes a removed clip', () => {
    const prev = { v1: clip({ blobKey: 'gone', name: 'a.mp4', size: 10 }) };
    expect(diffClips(prev, {})).toEqual({ write: [], prune: ['gone'] });
  });
});
