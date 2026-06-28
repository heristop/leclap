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
      durations: {} as Record<string, number>,
      videoInputs: [] as string[],
      musicInputs: [] as string[],
      musicFilters: [] as string[],
      fileConcatPath: '',
      musicPath: '',
      transitions: [] as Array<{ type: string; duration: number }>,
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
    read: vi.fn(async () => "file '/build/intro_output.mp4'\nfile '/build/clip_output.mp4'"),
    move: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined),
    // Default to "not bundled" so the URL-download path is still exercised by existing tests.
    resolveBundledMusic: vi.fn(async (): Promise<string | null> => null),
  };
}

let musicAdapter: { process: ReturnType<typeof vi.fn> };

function makeComposer(
  opts: {
    project?: ReturnType<typeof makeProject>;
    template?: ReturnType<typeof makeTemplate>;
    filesystem?: ReturnType<typeof makeFilesystem>;
    ffmpeg?: { execute: ReturnType<typeof vi.fn>; getInfos?: ReturnType<typeof vi.fn> };
  } = {}
) {
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

  it('fetches a named track from the asset source (GitHub LFS raw) when not cached, bundled, or given a url', async () => {
    const project = makeProject({ music: { name: 'orphan' } });
    const filesystem = makeFilesystem();
    filesystem.stat.mockResolvedValue(false);
    const { composer } = makeComposer({ project, filesystem });

    await composer.loadMusic();

    // `github.com/<o>/<r>/raw/…` resolves Git-LFS objects to the real binary; `raw.githubusercontent`
    // would serve the LFS pointer text instead.
    expect(filesystem.fetch).toHaveBeenCalledWith(
      'https://github.com/heristop/leclap/raw/main/packages/leclap-creative-kit/src/library/musics/orphan.mp3'
    );
    expect(project.buildInfos.musicPath).toBe('/build/assets/orphan.mp3');
  });

  it('treats a relative music url as a name hint and fetches it by name from the asset source', async () => {
    // Catalog templates carry `{ name, url: 'musics/<file>.mp3' }` — the url is an assets-dir hint, not
    // a fetchable URL. When the file is not local, fetch by name from the canonical remote, never the
    // relative path (which would `realpath`-crash on the Node adapter).
    const project = makeProject({ music: { name: 'point-being', url: 'musics/point-being.mp3' } });
    const filesystem = makeFilesystem();
    filesystem.stat.mockResolvedValue(false);
    const { composer } = makeComposer({ project, filesystem });

    await composer.loadMusic();

    expect(filesystem.fetch).toHaveBeenCalledWith(
      'https://github.com/heristop/leclap/raw/main/packages/leclap-creative-kit/src/library/musics/point-being.mp3'
    );
    expect(filesystem.fetch).not.toHaveBeenCalledWith('musics/point-being.mp3');
  });

  it('uses a bundled track by name (no URL, no download) when one ships with the package', async () => {
    const project = makeProject({ music: { name: 'air-prelude.mp3' } });
    const filesystem = makeFilesystem();
    filesystem.stat.mockResolvedValue(false);
    filesystem.resolveBundledMusic.mockResolvedValue('/pkg/dist/musics/air-prelude.mp3');
    const { composer } = makeComposer({ project, filesystem });

    await composer.loadMusic();

    expect(filesystem.resolveBundledMusic).toHaveBeenCalledWith('air-prelude.mp3');
    expect(project.buildInfos.musicPath).toBe('/pkg/dist/musics/air-prelude.mp3');
    expect(filesystem.fetch).not.toHaveBeenCalled();
  });
});

describe('MusicComposer.prepareMusicTrack', () => {
  it('builds a fade-in filter for the first section', () => {
    const project = makeProject();
    project.buildInfos.totalSegments = 3;
    const template = makeTemplate({ global: { transition: { type: 'fade', duration: 0.5 } } });
    const { composer } = makeComposer({ project, template });

    composer.prepareMusicTrack({ name: 's1', type: 'video', options: { duration: 4, musicVolume: 0.8 } });

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
    const template = makeTemplate({ global: { audio: { sourceVolume: 0.9 } } });
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

  it('consumes the concat demuxer and stream-copies video when given a concat source', async () => {
    const project = makeProject({ audioConfig: { sampleRate: 48000 } });
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const filesystem = makeFilesystem();
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, filesystem, ffmpeg });

    await composer.appendMusic(segments1, '/build/output.mp4', { kind: 'concat', listPath: '/build/segments.list' });

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('-f concat -safe 0 -auto_convert 1 -i /build/segments.list');
    expect(cmd).toContain('-c:v copy');
    expect(cmd).toContain('-map 0:v -map "[final]"');
    expect(cmd).toContain('+faststart /build/output.mp4');
    // probed the first listed segment for audio, not the not-yet-existing final output
    expect(ffmpeg.getInfos).toHaveBeenCalledWith('/build/intro_output.mp4');
    // folded path never moves the final output aside
    expect(filesystem.move).not.toHaveBeenCalled();
    expect(filesystem.unlink).not.toHaveBeenCalled();
  });

  it('still moves and reads a file source by default (unchanged behavior)', async () => {
    const project = makeProject({ audioConfig: { sampleRate: 48000 } });
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const filesystem = makeFilesystem();
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, filesystem, ffmpeg });

    await composer.appendMusic(segments1, '/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('-i /tmp/tmp_video_');
    expect(cmd).not.toContain('-f concat');
    expect(filesystem.move).toHaveBeenCalled();
    expect(filesystem.unlink).toHaveBeenCalled();
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

describe('MusicComposer.normalizeAudio / hasNormalization', () => {
  it('normalizes audio off a concat source while stream-copying video (no move)', async () => {
    const project = makeProject();
    const template = makeTemplate({ global: { audio: { normalize: 'loudnorm' } } });
    const filesystem = makeFilesystem();
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, template, filesystem, ffmpeg });

    await composer.normalizeAudio('/build/output.mp4', { kind: 'concat', listPath: '/build/segments.list' });

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('-f concat -safe 0 -auto_convert 1 -i /build/segments.list');
    expect(cmd).toContain('-af "loudnorm=I=-16:TP=-1.5:LRA=11"');
    expect(cmd).toContain('-c:v copy');
    expect(cmd).toContain('+faststart /build/output.mp4');
    expect(filesystem.move).not.toHaveBeenCalled();
  });

  it('moves and reads a file source by default (unchanged behavior)', async () => {
    const project = makeProject();
    const template = makeTemplate({ global: { audio: { normalize: 'dynaudnorm' } } });
    const filesystem = makeFilesystem();
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, template, filesystem, ffmpeg });

    await composer.normalizeAudio('/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('-i /tmp/tmp_normalize_');
    expect(cmd).not.toContain('-f concat');
    expect(filesystem.move).toHaveBeenCalled();
    expect(filesystem.unlink).toHaveBeenCalled();
  });

  it('is a no-op when no normalization is configured', async () => {
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ ffmpeg });

    await composer.normalizeAudio('/build/output.mp4', { kind: 'concat', listPath: '/build/segments.list' });

    expect(ffmpeg.execute).not.toHaveBeenCalled();
  });

  it('hasNormalization reflects the descriptor', () => {
    expect(
      makeComposer({
        template: makeTemplate({ global: { audio: { normalize: 'loudnorm' } } }),
      }).composer.hasNormalization()
    ).toBe(true);
    expect(makeComposer({}).composer.hasNormalization()).toBe(false);
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

describe('MusicComposer.prepareMusicTrack — source-contiguous windows', () => {
  it('does not shift the next window for a non-cut transition, so acrossfade legs stay source-contiguous', () => {
    const project = makeProject();
    project.buildInfos.totalSegments = 2;
    // Boundary 0 (after section 1) is a wipeleft transition of duration 0.5.
    project.buildInfos.transitions = [{ type: 'wipeleft', duration: 0.5 }];
    const template = makeTemplate({ global: { transition: { type: 'fade', duration: 0.3 } } });
    const { composer } = makeComposer({ project, template });

    // Section 1 (first): duration 4
    composer.prepareMusicTrack({ name: 's1', type: 'video', options: { duration: 4 } });
    // Section 2 (last): duration 4
    composer.prepareMusicTrack({ name: 's2', type: 'video', options: { duration: 4 } });

    const filters = project.buildInfos.musicFilters.join('');
    // Section 1: ss=0, window covers source [0, 4.3].
    expect(filters).toContain('atrim=start=0:duration=4.3');
    // Section 2 must start at the FULL section-1 duration (4), NOT 4 - 0.5. With start=4 the
    // acrossfade (d=0.3) blends section-1's last 0.3s (source [4.0, 4.3]) with section-2's first
    // 0.3s (source [4.0, 4.3]) — identical content, so the music stays continuous instead of
    // playing two offset copies of the song at the boundary.
    expect(filters).toContain('atrim=start=4:duration=4.3');
  });

  it('cut transition does not shift the window', () => {
    const project = makeProject();
    project.buildInfos.totalSegments = 2;
    project.buildInfos.transitions = [{ type: 'cut', duration: 0.5 }];
    const template = makeTemplate({ global: { transition: { type: 'fade', duration: 0.3 } } });
    const { composer } = makeComposer({ project, template });

    composer.prepareMusicTrack({ name: 's1', type: 'video', options: { duration: 4 } });
    composer.prepareMusicTrack({ name: 's2', type: 'video', options: { duration: 4 } });

    const filters = project.buildInfos.musicFilters.join('');
    // No shift: section 2 starts at 4 (full duration of section 1)
    expect(filters).toContain('atrim=start=4:duration=4.3');
  });

  it('missing transition entry is treated as cut (no shift)', () => {
    const project = makeProject();
    project.buildInfos.totalSegments = 2;
    // Empty transitions array — defensive against missing entry.
    project.buildInfos.transitions = [];
    const template = makeTemplate({ global: { transition: { type: 'fade', duration: 0.3 } } });
    const { composer } = makeComposer({ project, template });

    composer.prepareMusicTrack({ name: 's1', type: 'video', options: { duration: 5 } });
    composer.prepareMusicTrack({ name: 's2', type: 'video', options: { duration: 3 } });

    const filters = project.buildInfos.musicFilters.join('');
    expect(filters).toContain('atrim=start=5:duration=3.3');
  });

  it('keeps adjacent acrossfade legs source-contiguous across three sections (no doubled echo)', () => {
    const project = makeProject();
    project.buildInfos.totalSegments = 3;
    // Every boundary is a non-cut transition; whatever their nominal durations, the music windows
    // must stay contiguous in source time so each acrossfade splices identical audio.
    project.buildInfos.transitions = [
      { type: 'fade', duration: 0.5 },
      { type: 'wipeleft', duration: 0.7 },
    ];
    const template = makeTemplate({ global: { transition: { type: 'fade', duration: 0.3 } } });
    const { composer } = makeComposer({ project, template });

    composer.prepareMusicTrack({ name: 's1', type: 'video', options: { duration: 4 } });
    composer.prepareMusicTrack({ name: 's2', type: 'video', options: { duration: 6 } });
    composer.prepareMusicTrack({ name: 's3', type: 'video', options: { duration: 5 } });

    const filters = project.buildInfos.musicFilters.join('');
    // Each window starts at the cumulative FULL duration of the prior sections (0, 4, 10) and runs
    // for duration + global-transition (0.3). Leg N's tail [start+dur, start+dur+0.3] therefore
    // equals leg N+1's head [start, start+0.3], so the d=0.3 acrossfade never blends offset audio.
    expect(filters).toContain('atrim=start=0:duration=4.3'); // leg1 source [0, 4.3]
    expect(filters).toContain('atrim=start=4:duration=6.3'); // leg2 source [4, 10.3] — head [4,4.3] == leg1 tail
    expect(filters).toContain('atrim=start=10:duration=5.3'); // leg3 source [10, 15.3] — head [10,10.3] == leg2 tail
  });
});

describe('MusicComposer.appendMusic — normalize', () => {
  const segments1: Section[] = [{ name: 's1', type: 'video', options: { duration: 4 } }];

  it('appends loudnorm filter after the final mix when normalize is loudnorm', async () => {
    const project = makeProject({ audioConfig: { sampleRate: 48000 } });
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const template = makeTemplate({ global: { audio: { normalize: 'loudnorm' } } });
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, template, ffmpeg });

    await composer.appendMusic(segments1, '/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    // The normalize filter must sit INSIDE the chain, before the [final] label —
    // a labeled output ends an ffmpeg chain, so `[final],loudnorm` is invalid graph syntax.
    expect(cmd).toContain('loudnorm=I=-16:TP=-1.5:LRA=11[final]');
  });

  it('appends dynaudnorm filter after the final mix when normalize is dynaudnorm', async () => {
    const project = makeProject({ audioConfig: { sampleRate: 48000 } });
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const template = makeTemplate({ global: { audio: { normalize: 'dynaudnorm' } } });
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, template, ffmpeg });

    await composer.appendMusic(segments1, '/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('dynaudnorm=f=150:g=15[final]');
  });

  it('does not modify graph when no normalize is configured', async () => {
    const project = makeProject({ audioConfig: { sampleRate: 48000 } });
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const template = makeTemplate({ global: { audio: { sourceVolume: 1 } } });
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, template, ffmpeg });

    await composer.appendMusic(segments1, '/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).not.toContain('loudnorm');
    expect(cmd).not.toContain('dynaudnorm');
    expect(cmd).toContain('amix=inputs=2:duration=first[final]');
  });
});

describe('MusicComposer.appendMusic — ducking', () => {
  const segments1: Section[] = [{ name: 's1', type: 'video', options: { duration: 4 } }];

  it('inserts sidechaincompress with defaults when ducking is true', async () => {
    const project = makeProject({ audioConfig: { sampleRate: 48000 } });
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const template = makeTemplate({ global: { audio: { ducking: true } } });
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, template, ffmpeg });

    await composer.appendMusic(segments1, '/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400');
    expect(cmd).toContain('asplit=2');
    expect(cmd).toContain('amix=inputs=2:duration=first:normalize=0');
  });

  it('uses object ducking values when provided', async () => {
    const project = makeProject({ audioConfig: { sampleRate: 48000 } });
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const template = makeTemplate({ global: { audio: { ducking: { threshold: 0.1, ratio: 4 } } } });
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, template, ffmpeg });

    await composer.appendMusic(segments1, '/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('sidechaincompress=threshold=0.1:ratio=4:attack=20:release=400');
  });

  it('does not insert ducking when no ducking config is set (regression)', async () => {
    const project = makeProject({ audioConfig: { sampleRate: 48000 } });
    project.buildInfos.musicPath = '/cache/musics/song.mp3';
    const template = makeTemplate({});
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ project, template, ffmpeg });

    await composer.appendMusic(segments1, '/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).not.toContain('sidechaincompress');
    expect(cmd).not.toContain('asplit');
    // The non-ducking path keeps the original plain amix (no normalize=0)
    expect(cmd).toContain('amix=inputs=2:duration=first[final]');
    expect(cmd).not.toContain('normalize=0');
  });
});

describe('MusicComposer.normalizeAudio — no-music path', () => {
  it('runs a loudnorm filter command and replaces the output file', async () => {
    const template = makeTemplate({ global: { audio: { normalize: 'loudnorm' } } });
    const filesystem = makeFilesystem();
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ template, filesystem, ffmpeg });

    await composer.normalizeAudio('/build/output.mp4');

    expect(filesystem.move).toHaveBeenCalled();
    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('loudnorm=I=-16:TP=-1.5:LRA=11');
    expect(cmd).toContain('-c:v copy');
    expect(filesystem.unlink).toHaveBeenCalled();
  });

  it('runs a dynaudnorm filter command when normalize is dynaudnorm', async () => {
    const template = makeTemplate({ global: { audio: { normalize: 'dynaudnorm' } } });
    const filesystem = makeFilesystem();
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ template, filesystem, ffmpeg });

    await composer.normalizeAudio('/build/output.mp4');

    const cmd = ffmpeg.execute.mock.calls[0][0];
    expect(cmd).toContain('dynaudnorm=f=150:g=15');
  });

  it('is a no-op when no normalize is configured', async () => {
    const template = makeTemplate({});
    const filesystem = makeFilesystem();
    const ffmpeg = {
      execute: vi.fn<(cmd: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ template, filesystem, ffmpeg });

    await composer.normalizeAudio('/build/output.mp4');

    expect(filesystem.move).not.toHaveBeenCalled();
    expect(ffmpeg.execute).not.toHaveBeenCalled();
  });

  it('throws when the ffmpeg normalize command fails (rc 1)', async () => {
    const template = makeTemplate({ global: { audio: { normalize: 'loudnorm' } } });
    const filesystem = makeFilesystem();
    const ffmpeg = {
      execute: vi.fn(async () => ({ rc: 1 })),
      getInfos: vi.fn(async () => ({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 })),
    };
    const { composer } = makeComposer({ template, filesystem, ffmpeg });

    await expect(composer.normalizeAudio('/build/output.mp4')).rejects.toThrow('Error on audio normalization');
    expect(filesystem.unlink).not.toHaveBeenCalled();
  });
});
