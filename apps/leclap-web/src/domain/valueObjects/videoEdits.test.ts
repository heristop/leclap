import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock ffmpeg.wasm so applyVideoEdits runs without loading a real core ---
const loadMock = vi.fn(async () => {});
const writeFileMock = vi.fn(async () => {});
const execMock = vi.fn(async (_args: string[]) => {});
const readFileMock = vi.fn(async () => new Uint8Array([0, 1, 2, 3]));
const deleteFileMock = vi.fn(async () => {});
const onMock = vi.fn();
const offMock = vi.fn();

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    load = loadMock;
    writeFile = writeFileMock;
    exec = execMock;
    readFile = readFileMock;
    deleteFile = deleteFileMock;
    on = onMock;
    off = offMock;
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
  resolveSegments,
  isTimelineApplied,
  buildTimelineArgs,
  type VideoEdit,
  type ClipSegment,
} from '@/domain/valueObjects/videoEdits';

const seg = (start: number, end: number, speed = 1, id = `s-${start}-${end}`): ClipSegment => ({
  id,
  start,
  end,
  speed,
});

const makeFile = (name = 'clip.mov') => new File([new Blob(['data'])], name, { type: 'video/quicktime' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isCropApplied', () => {
  it('is false for undefined and the full frame', () => {
    expect(isCropApplied()).toBe(false);
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
    expect(isEditApplied()).toBe(false);
    expect(isEditApplied({ crop: { x: 0, y: 0, w: 1, h: 1 } })).toBe(false);
    expect(isEditApplied({ trim: { start: 0, end: 10 } }, 10)).toBe(false);
  });

  it('is true when a crop or a meaningful trim is present', () => {
    expect(isEditApplied({ crop: { x: 0.1, y: 0, w: 1, h: 1 } })).toBe(true);
    expect(isEditApplied({ trim: { start: 2, end: 10 } })).toBe(true);
  });
});

describe('resolveSegments', () => {
  it('returns explicit segments when present', () => {
    const segments = [seg(0, 3, 2), seg(5, 9, 1)];
    expect(resolveSegments({ segments }, 10)).toBe(segments);
  });

  it('migrates a legacy trim into one full-speed segment', () => {
    expect(resolveSegments({ trim: { start: 2, end: 8 } }, 10)).toEqual([{ id: 'seg-0', start: 2, end: 8, speed: 1 }]);
  });

  it('falls back to one whole-clip segment when there is no edit', () => {
    expect(resolveSegments(undefined, 10)).toEqual([{ id: 'seg-0', start: 0, end: 10, speed: 1 }]);
  });

  it('fills a legacy trim with no end from the clip duration', () => {
    expect(resolveSegments({ trim: { start: 1, end: 0 } }, 10)).toEqual([{ id: 'seg-0', start: 1, end: 10, speed: 1 }]);
  });
});

describe('isTimelineApplied', () => {
  it('is true with more than one segment', () => {
    expect(isTimelineApplied([seg(0, 3), seg(3, 6)], 6)).toBe(true);
  });

  it('is true when any segment is sped up or slowed down', () => {
    expect(isTimelineApplied([seg(0, 6, 1.5)], 6)).toBe(true);
  });

  it('is true when the single segment is trimmed', () => {
    expect(isTimelineApplied([seg(2, 6)], 6)).toBe(true);
    expect(isTimelineApplied([seg(0, 4)], 6)).toBe(true);
  });

  it('is false for one untouched full-speed whole-clip segment', () => {
    expect(isTimelineApplied([seg(0, 6, 1)], 6)).toBe(false);
  });
});

describe('buildTimelineArgs', () => {
  it('builds a trim/setpts + atrim/atempo + concat graph for a multi-segment clip with audio', () => {
    const args = buildTimelineArgs('in.mp4', 'out.mp4', [seg(0, 3, 2), seg(5, 9, 1)], undefined, true);
    const fc = args[args.indexOf('-filter_complex') + 1];

    expect(fc).toContain('[0:v]trim=start=0:end=3,setpts=(PTS-STARTPTS)/2[v0]');
    expect(fc).toContain('[0:a]atrim=start=0:end=3,asetpts=PTS-STARTPTS,atempo=2[a0]');
    expect(fc).toContain('[0:v]trim=start=5:end=9,setpts=(PTS-STARTPTS)/1[v1]');
    expect(fc).toContain('[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]');
    expect(args).toContain('-map');
    expect(args.slice(args.indexOf('-map'))).toContain('[v]');
    expect(args).toContain('libx264');
  });

  it('omits the audio chains and concats video-only when the clip has no audio', () => {
    const args = buildTimelineArgs('in.mp4', 'out.mp4', [seg(0, 3, 2), seg(5, 9, 1)], undefined, false);
    const fc = args[args.indexOf('-filter_complex') + 1];

    expect(fc).not.toContain('atrim');
    expect(fc).not.toContain('atempo');
    expect(fc).toContain('[v0][v1]concat=n=2:v=1:a=0[v]');
    expect(args).not.toContain('-c:a');
  });

  it('prepends the crop filter to each video chain', () => {
    const args = buildTimelineArgs('in.mp4', 'out.mp4', [seg(0, 3, 1)], { x: 0.1, y: 0.2, w: 0.5, h: 0.6 }, true);
    const fc = args[args.indexOf('-filter_complex') + 1];

    expect(fc).toContain(
      '[0:v]crop=trunc(iw*0.5/2)*2:trunc(ih*0.6/2)*2:trunc(iw*0.1):trunc(ih*0.2),trim=start=0:end=3'
    );
  });
});

describe('applyVideoEdits', () => {
  it('returns the original files untouched when no clip has a meaningful edit', async () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4')];

    const result = await applyVideoEdits(files, {}, ['s0', 's1']);

    expect(result).toBe(files);
    expect(execMock).not.toHaveBeenCalled();
  });

  it('crops a clip with a normalized iw/ih filter and renames it video_<n>.mp4', async () => {
    const files = [makeFile('clip.mov')];
    const edits: Record<string, VideoEdit> = {
      s0: { crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 } },
    };

    const [out] = await applyVideoEdits(files, edits, ['s0']);

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
    const edits: Record<string, VideoEdit> = { s0: { trim: { start: 2, end: 8 } } };

    await applyVideoEdits(files, edits, ['s0']);

    const args = execMock.mock.calls[0][0];
    expect(args).toContain('-ss');
    expect(args[args.indexOf('-ss') + 1]).toBe('2');
    expect(args).toContain('-to');
    expect(args[args.indexOf('-to') + 1]).toBe('8');
    expect(args).not.toContain('-vf'); // no crop
  });

  it('passes un-edited clips through and only processes edited ones', async () => {
    const files = [makeFile('keep.mp4'), makeFile('edit.mp4')];
    const edits: Record<string, VideoEdit> = { s1: { crop: { x: 0, y: 0, w: 0.8, h: 0.8 } } };

    const result = await applyVideoEdits(files, edits, ['s0', 's1']);

    expect(result[0]).toBe(files[0]); // untouched original
    expect(result[1]).not.toBe(files[1]);
    expect(result[1].name).toBe('video_2.mp4');
    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it('renders a multi-segment timeline through a concat filter_complex', async () => {
    const files = [makeFile('clip.mp4')];
    const edits: Record<string, VideoEdit> = {
      s0: { segments: [seg(0, 3, 2), seg(5, 9, 1)] },
    };

    await applyVideoEdits(files, edits, ['s0']);

    // The audio-probe pass runs first; the render pass carries the filter_complex.
    const renderArgs = execMock.mock.calls.map((c) => c[0]).find((a) => a.includes('-filter_complex'));
    expect(renderArgs).toBeTruthy();
    expect(renderArgs?.[renderArgs.indexOf('-filter_complex') + 1]).toContain('concat=n=2');
  });

  it('falls back to the original clip when ffmpeg fails', async () => {
    execMock.mockRejectedValueOnce(new Error('ffmpeg boom'));
    const files = [makeFile('clip.mp4')];
    const edits: Record<string, VideoEdit> = { s0: { crop: { x: 0.2, y: 0.2, w: 0.5, h: 0.5 } } };

    const [out] = await applyVideoEdits(files, edits, ['s0']);

    expect(out).toBe(files[0]); // original returned on failure
    expect(deleteFileMock).toHaveBeenCalled(); // cleanup still ran
  });
});
