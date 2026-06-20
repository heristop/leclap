import { describe, it, expect } from 'vitest';
import { diffRushes, deriveSelectedClips, withSelectedRushes } from './projectRushes';
import { EMPTY_MODEL, type WizardModel } from '@/lib/wizardModel';
import type { StoredClip } from '@/lib/projectModel';

const clip = (over: Partial<StoredClip> = {}): StoredClip => ({
  blobKey: 'blob-1',
  name: 'a.mp4',
  type: 'video/mp4',
  size: 100,
  ...over,
});

const file = (name: string, size: number): File => new File([new Uint8Array(size)], name, { type: 'video/mp4' });

const modelWith = (over: Partial<WizardModel>): WizardModel => ({ ...EMPTY_MODEL, ...over });

describe('diffRushes', () => {
  it('writes a brand-new take and prunes nothing', () => {
    expect(diffRushes({}, { v1: [file('a.mp4', 10)] })).toEqual({ write: [{ section: 'v1', index: 0 }], prune: [] });
  });

  it('writes only the newly added second take, reusing the first', () => {
    const prev = { v1: [clip({ blobKey: 'k1', name: 'a.mp4', size: 10 })] };
    const result = diffRushes(prev, { v1: [file('a.mp4', 10), file('b.mp4', 20)] });

    expect(result.write).toEqual([{ section: 'v1', index: 1 }]);
    expect(result.prune).toEqual([]);
  });

  it('prunes a removed take by its blob key', () => {
    const prev = {
      v1: [clip({ blobKey: 'keep', name: 'a.mp4', size: 10 }), clip({ blobKey: 'gone', name: 'b.mp4', size: 20 })],
    };
    const result = diffRushes(prev, { v1: [file('a.mp4', 10)] });

    expect(result.write).toEqual([]);
    expect(result.prune).toEqual(['gone']);
  });

  it('reuses unchanged takes (none written)', () => {
    const prev = { v1: [clip({ blobKey: 'k1', name: 'a.mp4', size: 10 })] };
    expect(diffRushes(prev, { v1: [file('a.mp4', 10)] })).toEqual({ write: [], prune: [] });
  });
});

describe('withSelectedRushes', () => {
  it('unions the selected clip into its section when missing from the takes', () => {
    const selected = file('sel.mp4', 5);
    const effective = withSelectedRushes(
      modelWith({ clipsBySection: { v1: selected }, rushesBySection: { v1: [file('a.mp4', 10)] } })
    );

    expect(effective.v1).toHaveLength(2);
    expect(effective.v1[1]).toBe(selected);
  });

  it('leaves the take list untouched when the selected clip is already present', () => {
    const selected = file('a.mp4', 10);
    const effective = withSelectedRushes(
      modelWith({ clipsBySection: { v1: selected }, rushesBySection: { v1: [selected] } })
    );

    expect(effective.v1).toHaveLength(1);
  });
});

describe('deriveSelectedClips', () => {
  it('shares the matching take blobKey for the selected clip', () => {
    const rushes = {
      v1: [clip({ blobKey: 'k1', name: 'a.mp4', size: 10 }), clip({ blobKey: 'k2', name: 'b.mp4', size: 20 })],
    };
    const clips = deriveSelectedClips(rushes, modelWith({ clipsBySection: { v1: file('b.mp4', 20) } }));

    expect(clips.v1.blobKey).toBe('k2');
  });
});
