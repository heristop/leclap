import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSectionInfos, type SectionInfosDeps } from '@/director/sectionInfos';
import type { Section } from '@/core/types';

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeDeps(over: Partial<SectionInfosDeps> = {}): SectionInfosDeps {
  return {
    config: { userVideoPaths: undefined } as never,
    ffmpegAdapter: {
      getInfos: vi.fn().mockResolvedValue({ duration: 4, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 44100 }),
    } as never,
    filesystemAdapter: {
      getAssetsDir: (type: string) => `/work/assets/${type}`,
      stat: vi.fn().mockResolvedValue(false),
      fetch: vi.fn().mockResolvedValue('/tmp/dl.mp4'),
      move: vi.fn().mockResolvedValue(undefined),
    } as never,
    logger: logger as never,
    ...over,
  };
}

const projectVideo = (name: string): Section => ({ name, type: 'project_video', options: { duration: 4 } }) as Section;

describe('fetchSectionInfos — project_video demo-clip staging', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stages the catalog demo clip from the asset source when no user clip and no local copy exist', async () => {
    const deps = makeDeps();
    const section = projectVideo('video_1');

    const infos = await fetchSectionInfos(deps, section);

    // It downloads the catalog clip by its assets-relative path (the adapter resolves it to the public
    // library) and moves it onto the assets-dir source path both the probe and the segment `-i` use.
    expect(deps.filesystemAdapter.fetch).toHaveBeenCalledWith('videos/video_1.mp4');
    expect(deps.filesystemAdapter.move).toHaveBeenCalledWith('/tmp/dl.mp4', '/work/assets/videos/video_1.mp4');
    expect(deps.ffmpegAdapter.getInfos).toHaveBeenCalledWith('/work/assets/videos/video_1.mp4');
    expect(infos.duration).toBe(4);
  });

  it('does not stage when the clip already exists locally', async () => {
    const deps = makeDeps({
      filesystemAdapter: {
        getAssetsDir: (type: string) => `/work/assets/${type}`,
        stat: vi.fn().mockResolvedValue(true),
        fetch: vi.fn(),
        move: vi.fn(),
      } as never,
    });

    await fetchSectionInfos(deps, projectVideo('video_1'));

    expect(deps.filesystemAdapter.fetch).not.toHaveBeenCalled();
    expect(deps.filesystemAdapter.move).not.toHaveBeenCalled();
  });

  it('does not stage when the user supplied a recording for the section', async () => {
    const deps = makeDeps({
      config: { userVideoPaths: { video_1: '/recordings/video_1.mp4' } } as never,
      filesystemAdapter: {
        getAssetsDir: (type: string) => `/work/assets/${type}`,
        stat: vi.fn().mockResolvedValue(true),
        fetch: vi.fn(),
        move: vi.fn(),
      } as never,
    });

    await fetchSectionInfos(deps, projectVideo('video_1'));

    expect(deps.filesystemAdapter.fetch).not.toHaveBeenCalled();
    expect(deps.ffmpegAdapter.getInfos).toHaveBeenCalledWith('/recordings/video_1.mp4');
  });

  it('falls back to the declared duration (does not throw) when the demo clip cannot be staged', async () => {
    const deps = makeDeps({
      filesystemAdapter: {
        getAssetsDir: (type: string) => `/work/assets/${type}`,
        stat: vi.fn().mockResolvedValue(false),
        fetch: vi.fn().mockRejectedValue(new Error('network down')),
        move: vi.fn(),
      } as never,
      ffmpegAdapter: { getInfos: vi.fn().mockRejectedValue(new Error('no such file')) } as never,
    });

    const infos = await fetchSectionInfos(deps, projectVideo('video_1'));

    expect(infos.duration).toBe(4);
  });
});
