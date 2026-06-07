import 'reflect-metadata';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { container } from 'tsyringe';
import MusicComposer from '@/editor/MusicComposer';
import type { ProjectConfig, Section, TemplateDescriptor } from '@/core/types';

function makeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeProject(config: ProjectConfig = {}) {
  return {
    config,
    finalVideo: '',
    errors: [] as string[],
    buildInfos: {
      totalSegments: 0,
      totalLength: 0,
      currentLength: 0,
      currentProgress: 0,
      currentIncrement: 0,
      durations: [] as number[],
      videoInputs: [] as string[],
      musicInputs: [] as string[],
      musicFilters: [] as string[],
      fileConcatPath: '',
      musicPath: '',
    },
  };
}

function makeTemplate(descriptor: TemplateDescriptor = {}) {
  return { descriptor, assets: { fonts: {}, musics: {}, inputs: [] } };
}

function makeFilesystem() {
  return {
    getBuildPath: vi.fn(async () => '/build/assets'),
    getAssetsPath: vi.fn(async () => '/cache/musics'),
    getTempDir: vi.fn(() => '/tmp'),
    stat: vi.fn(async () => false),
    fetch: vi.fn(async () => '/downloads/track.mp3'),
    move: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined),
  };
}

let musicAdapter: { process: ReturnType<typeof vi.fn> };

function makeComposer(opts: {
  project?: ReturnType<typeof makeProject>;
  template?: ReturnType<typeof makeTemplate>;
  filesystem?: ReturnType<typeof makeFilesystem>;
  ffmpeg?: { execute: ReturnType<typeof vi.fn>; getInfos?: ReturnType<typeof vi.fn> };
} = {}) {
  const project = opts.project ?? makeProject();
  const template = opts.template ?? makeTemplate();
  const filesystem = opts.filesystem ?? makeFilesystem();
  const ffmpeg = opts.ffmpeg ?? {
    execute: vi.fn(async () => ({ rc: 0 })),
    // appendMusic probes the concat output for an audio stream; default to "has audio".
    getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
  };
  const logger = makeLogger();

  musicAdapter = { process: vi.fn(async () => ({ rc: 0 })) };
  container.registerInstance('musicAdapter', musicAdapter);

  const composer = new MusicComposer(
    project as never,
    template as never,
    logger as never,
    ffmpeg as never,
    filesystem as never
  );

  return { composer, project, template, filesystem, ffmpeg, logger };
}

beforeEach(() => {
  vi.clearAllMocks();
  container.clearInstances();
});

describe('MusicComposer.loadMusic', () => {
  it('returns early when no music is configured anywhere', async () => {
    const { composer, project } = makeComposer();

    await composer.loadMusic();

    expect(project.buildInfos.musicPath).toBe('');
  });

  it('falls back to template global music when project config has none', async () => {
    const template = makeTemplate({ global: { music: { name: 'epic.mp3' } } });
    const filesystem = makeFilesystem();
    filesystem.stat.mockResolvedValue(true); // exists in cache
    const { composer, project } = makeComposer({ template, filesystem });

    await composer.loadMusic();

    expect(project.config.music).toEqual({ name: 'epic.mp3' });
    expect(project.buildInfos.musicPath).toBe('/cache/musics/epic.mp3');
  });

  it('loads music from cache when the file already exists', async () => {
    const project = makeProject({ music: { name: 'song.mp3' } });
    const filesystem = makeFilesystem();
    filesystem.stat.mockResolvedValue(true);
    const { composer, logger } = makeComposer({ project, filesystem });

    await composer.loadMusic();

    expect(project.buildInfos.musicPath).toBe('/cache/musics/song.mp3');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded from cache'));
    expect(filesystem.fetch).not.toHaveBeenCalled();
  });

  it('downloads and saves music from a URL when not cached', async () => {
    const project = makeProject({ music: { name: 'remote', url: 'https://cdn.test/remote.mp3' } });
    const filesystem = makeFilesystem();
    filesystem.stat.mockResolvedValue(false);
    const { composer } = makeComposer({ project, filesystem });

    await composer.loadMusic();

    expect(filesystem.fetch).toHaveBeenCalledWith('https://cdn.test/remote.mp3');
    expect(filesystem.move).toHaveBeenCalledWith('/downloads/track.mp3', '/build/assets/remote.mp3');
    expect(project.buildInfos.musicPath).toBe('/build/assets/remote.mp3');
  });

  it('derives the music name from the URL when no name is provided', async () => {
    const project = makeProject({ music: { name: '', url: 'https://cdn.test/path/cool-track.mp3' } });
    const filesystem = makeFilesystem();
    filesystem.stat.mockResolvedValue(false);
    const { composer } = makeComposer({ project, filesystem });

    await composer.loadMusic();

    expect(project.buildInfos.musicPath).toBe('/build/assets/cool-track.mp3');
  });

  it('throws when music is configured without a URL and is not cached', async () => {
    const project = makeProject({ music: { name: 'orphan.mp3' } });
    const filesystem = makeFilesystem();
    filesystem.stat.mockResolvedValue(false);
    const { composer } = makeComposer({ project, filesystem });

    await expect(composer.loadMusic()).rejects.toThrow('Music URL is not provided.');
  });
});

describe('MusicComposer.prepareMusicTrack', () => {
  it('builds a fade-in filter for the first section', () => {
    const project = makeProject();
    project.buildInfos.totalSegments = 3;
    const template = makeTemplate({ global: { transitionDuration: 0.5 } });
    const { composer } = makeComposer({ project, template });

    composer.prepareMusicTrack({ name: 's1', type: 'video', options: { duration: 4, musicVolumeLevel: 0.8 } });

    expect(project.buildInfos.currentIncrement).toBe(1);
    const filters = project.buildInfos.musicFilters.join('');
    expect(filters).toContain('afade=t=in:st=0:d=0.5');
    expect(filters).toContain('volume=0.8');
  });

  it('builds a middle-section filter plus a crossfade against the first section', () => {
    const project = makeProject();
    project.buildInfos.totalSegments = 3;
    project.buildInfos.currentIncrement = 1;
    const { composer } = makeComposer({ project });

    composer.prepareMusicTrack({ name: 's2', type: 'video', options: { duration: 4 } });

    const filters = project.buildInfos.musicFilters.join('');
    // default volume level 0.5, no fade for a middle section
    expect(filters).toContain('volume=0.5[section2]');
    // crossfade between section1 and section2
    expect(filters).toContain('[section1][section2]acrossfade');
    expect(filters).toContain('[crossed1]');
  });

  it('builds a fade-out filter for the last section and a lastcrossed crossfade', () => {
    const project = makeProject();
    project.buildInfos.totalSegments = 3;
    project.buildInfos.currentIncrement = 2;
    const { composer } = makeComposer({ project });

    composer.prepareMusicTrack({ name: 's3', type: 'video', options: { duration: 4 } });

    const filters = project.buildInfos.musicFilters.join('');
    expect(filters).toContain('afade=t=out');
    expect(filters).toContain('[lastsection]');
    // previousMapName for increment 3 is crossed1, mapped to lastcrossed
    expect(filters).toContain('[crossed1][lastsection]acrossfade');
    expect(filters).toContain('[lastcrossed]');
  });
});

describe('MusicComposer.appendMusic', () => {
  const segments1: Section[] = [{ name: 's1', type: 'video', options: { duration: 4 } }];
  const segmentsMulti: Section[] = [
    { name: 's1', type: 'video', options: { duration: 4 } },
    { name: 's2', type: 'video', options: { duration: 4 } },
  ];

  it('builds a single-segment filter complex and mixes the music', async () => {
    const project = makeProject({ audioConfig: { sampleRate: 48000 } });
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const template = makeTemplate({ global: { audioVolumeLevel: 0.9 } });
    const filesystem = makeFilesystem();
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, template, filesystem, ffmpeg });

    await composer.appendMusic(segments1, '/build/output.mp4');

    expect(filesystem.move).toHaveBeenCalled();
    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('volume=0.9');
    expect(cmd).toContain('sample_rates=48000');
    // single-segment path uses [1:a] directly (no musicFilters join)
    expect(cmd).toContain('[1:a]aformat');
    expect(cmd).toContain('amix=inputs=2:duration=first[final]');
    expect(filesystem.unlink).toHaveBeenCalled();
  });

  it('builds a multi-segment filter complex using the accumulated music filters', async () => {
    const project = makeProject();
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    project.buildInfos.musicFilters = [' [filterA];', ' [filterB];'];
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, ffmpeg });

    await composer.appendMusic(segmentsMulti, '/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('[filterA]');
    expect(cmd).toContain('[lastcrossed]');
    // default audio volume level is 1 when not set
    expect(cmd).toContain('volume=1');
  });

  it('builds a music-only graph when the concat output has no audio stream', async () => {
    // A video-only upload yields an audio-less concat output. The filtergraph
    // must NOT reference [0:a] (which would abort: "matches no streams") and must
    // route the music straight to [final] instead of amix-ing with absent audio.
    const project = makeProject({ audioConfig: { sampleRate: 48000 } });
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: null, sampleRate: null })),
    };
    const { composer } = makeComposer({ project, ffmpeg });

    await composer.appendMusic(segments1, '/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).not.toContain('[0:a]');
    expect(cmd).not.toContain('amix');
    expect(cmd).toContain('[1:a]');
    expect(cmd).toContain('[final]');
    // The output map is still video + the produced [final] audio.
    expect(cmd).toContain('-map 0:v -map "[final]"');
  });

  it('throws when the music mixing ffmpeg command fails (rc 1)', async () => {
    const project = makeProject();
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const ffmpeg = {
      execute: vi.fn(async () => ({ rc: 1 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const filesystem = makeFilesystem();
    const { composer } = makeComposer({ project, ffmpeg, filesystem });

    await expect(composer.appendMusic(segments1, '/build/output.mp4')).rejects.toThrow('Error on music add');
    // temp file is not unlinked when the command failed
    expect(filesystem.unlink).not.toHaveBeenCalled();
  });
});

describe('MusicComposer.loopMusic', () => {
  it('delegates to the music adapter with total length and music path', async () => {
    const project = makeProject();
    project.buildInfos.totalLength = 42;
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const { composer, filesystem, logger } = makeComposer({ project });

    await composer.loopMusic();

    expect(musicAdapter.process).toHaveBeenCalledWith(logger, filesystem, 42, '/cache/musics/song.mp3');
  });
});
