import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock ffmpeg.wasm so applyVideoEdits runs without loading a real core ---
const loadMock = vi.fn(async () => undefined);
const writeFileMock = vi.fn(async () => undefined);
const execMock = vi.fn(async (_args: string[]) => undefined);
const readFileMock = vi.fn(async () => new Uint8Array([0, 1, 2, 3]));
const deleteFileMock = vi.fn(async () => undefined);

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    load = loadMock;
    writeFile = writeFileMock;
    exec = execMock;
    readFile = readFileMock;
    deleteFile = deleteFileMock;
  },
}));

vi.mock('@ffmpeg/util', () => ({
  fetchFile: vi.fn(async () => new Uint8Array([9, 9, 9])),
  toBlobURL: vi.fn(async (url: string) => `blob:${url}`),
}));

import {
  isCropApplied,
  isTrimApplied,
  isEditApplied,
  applyVideoEdits,
  type VideoEdit,
} from '@/domain/valueObjects/videoEdits';

const makeFile = (name = 'clip.mov') => new File([new Blob(['data'])], name, { type: 'video/quicktime' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isCropApplied', () => {
  it('is false for undefined and the full frame', () => {
    expect(isCropApplied(undefined)).toBe(false);
    expect(isCropApplied({ x: 0, y: 0, w: 1, h: 1 })).toBe(false);
  });

  it('is true once the frame is moved or shrunk', () => {
    expect(isCropApplied({ x: 0.1, y: 0, w: 1, h: 1 })).toBe(true);
    expect(isCropApplied({ x: 0, y: 0.2, w: 1, h: 1 })).toBe(true);
    expect(isCropApplied({ x: 0, y: 0, w: 0.5, h: 1 })).toBe(true);
    expect(isCropApplied({ x: 0, y: 0, w: 1, h: 0.5 })).toBe(true);
  });
});

describe('isTrimApplied', () => {
  it('is false for undefined and the full clip range', () => {
    expect(isTrimApplied(undefined, 10)).toBe(false);
    expect(isTrimApplied({ start: 0, end: 10 }, 10)).toBe(false);
  });

  it('is true when the start moves in or the end pulls before the duration', () => {
    expect(isTrimApplied({ start: 2, end: 10 }, 10)).toBe(true);
    expect(isTrimApplied({ start: 0, end: 7 }, 10)).toBe(true);
  });

  it('ignores epsilon-level differences', () => {
    expect(isTrimApplied({ start: 0.01, end: 9.99 }, 10)).toBe(false);
  });
});

describe('isEditApplied', () => {
  it('is false for undefined / no-op edits', () => {
    expect(isEditApplied(undefined)).toBe(false);
    expect(isEditApplied({ crop: { x: 0, y: 0, w: 1, h: 1 } })).toBe(false);
    expect(isEditApplied({ trim: { start: 0, end: 10 } }, 10)).toBe(false);
  });

  it('is true when a crop or a meaningful trim is present', () => {
    expect(isEditApplied({ crop: { x: 0.1, y: 0, w: 1, h: 1 } })).toBe(true);
    expect(isEditApplied({ trim: { start: 2, end: 10 } })).toBe(true);
  });
});

describe('applyVideoEdits', () => {
  it('returns the original files untouched when no clip has a meaningful edit', async () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4')];

    const result = await applyVideoEdits(files, {});

    expect(result).toBe(files);
    expect(execMock).not.toHaveBeenCalled();
  });

  it('crops a clip with a normalized iw/ih filter and renames it video_<n>.mp4', async () => {
    const files = [makeFile('clip.mov')];
    const edits: Record<number, VideoEdit> = {
      0: { crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 } },
    };

    const [out] = await applyVideoEdits(files, edits);

    expect(out).toBeInstanceOf(File);
    expect(out.name).toBe('video_1.mp4');
    expect(out.type).toBe('video/mp4');

    const args = execMock.mock.calls[0][0];
    const vfIndex = args.indexOf('-vf');
    expect(vfIndex).toBeGreaterThanOrEqual(0);
    expect(args[vfIndex + 1]).toBe('crop=trunc(iw*0.5/2)*2:trunc(ih*0.6/2)*2:trunc(iw*0.1):trunc(ih*0.2)');
    // re-encode tail
    expect(args).toContain('libx264');
    expect(args).toContain('yuv420p');
  });

  it('trims a clip with -ss/-to output seeking', async () => {
    const files = [makeFile('clip.mp4')];
    const edits: Record<number, VideoEdit> = { 0: { trim: { start: 2, end: 8 } } };

    await applyVideoEdits(files, edits);

    const args = execMock.mock.calls[0][0];
    expect(args).toContain('-ss');
    expect(args[args.indexOf('-ss') + 1]).toBe('2');
    expect(args).toContain('-to');
    expect(args[args.indexOf('-to') + 1]).toBe('8');
    expect(args).not.toContain('-vf'); // no crop
  });

  it('passes un-edited clips through and only processes edited ones', async () => {
    const files = [makeFile('keep.mp4'), makeFile('edit.mp4')];
    const edits: Record<number, VideoEdit> = { 1: { crop: { x: 0, y: 0, w: 0.8, h: 0.8 } } };

    const result = await applyVideoEdits(files, edits);

    expect(result[0]).toBe(files[0]); // untouched original
    expect(result[1]).not.toBe(files[1]);
    expect(result[1].name).toBe('video_2.mp4');
    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original clip when ffmpeg fails', async () => {
    execMock.mockRejectedValueOnce(new Error('ffmpeg boom'));
    const files = [makeFile('clip.mp4')];
    const edits: Record<number, VideoEdit> = { 0: { crop: { x: 0.2, y: 0.2, w: 0.5, h: 0.5 } } };

    const [out] = await applyVideoEdits(files, edits);

    expect(out).toBe(files[0]); // original returned on failure
    expect(deleteFileMock).toHaveBeenCalled(); // cleanup still ran
  });
});
