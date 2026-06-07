import 'reflect-metadata';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import TemplateDirector from '@/director/TemplateDirector';
import type { FFMpegInfos, ProjectConfig, Section, TemplateDescriptor } from '@/core/types';

function makeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

type EmitterStub = {
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  handlers: Record<string, (...args: unknown[]) => void>;
};

function makeEmitter(): EmitterStub {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const emitter: EmitterStub = {
    handlers,
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;

      return emitter;
    }),
    emit: vi.fn(() => true),
  };

  return emitter;
}

function makeProject() {
  return {
    config: {} as ProjectConfig,
    progress: 0,
    errors: [] as string[],
    finalVideo: '',
    applyDefault: vi.fn(),
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
    },
  };
}

function makeFilesystem() {
  return {
    setBuildDir: vi.fn(),
    setAssetsDir: vi.fn(),
    getBuildDir: vi.fn(() => '/build'),
    getAssetsDir: vi.fn((t: string) => `/assets/${t}`),
    write: vi.fn(async () => undefined),
    append: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined),
    stat: vi.fn(async () => true),
  };
}

function makeDeps() {
  const project = makeProject();
  const logger = makeLogger();
  const filesystem = makeFilesystem();
  const template = { descriptor: {} as TemplateDescriptor, assets: {} };

  const concreteBuilder = {
    buildPart: vi.fn(async () => true),
    renderPart: vi.fn(async () => undefined),
  };
  const musicComposer = {
    loadMusic: vi.fn(async () => undefined),
    prepareMusicTrack: vi.fn(),
    loopMusic: vi.fn(async () => undefined),
    appendMusic: vi.fn(async () => undefined),
  };
  const ffmpeg = {
    execute: vi.fn(async () => ({ rc: 0 })),
    getInfos: vi.fn(async (): Promise<FFMpegInfos> => ({ duration: 5, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 44100 })),
  };

  return {
    project,
    logger,
    filesystem,
    template,
    concreteBuilder,
    musicComposer,
    ffmpeg,
    directorDeps: {
      concreteBuilder,
      musicComposer,
      project,
      template,
      logger,
      ffmpegAdapter: ffmpeg,
      filesystemAdapter: filesystem,
    },
  };
}

function makeDirector() {
  const deps = makeDeps();
  const emitter = makeEmitter();
  const eventManager = { connect: vi.fn(() => emitter) };
  const videoEditor = {
    emitter: undefined as unknown,
    concat: vi.fn(async () => '/build/output.mp4'),
    finalize: vi.fn(async () => undefined),
  };

  const director = new TemplateDirector(
    eventManager as never,
    videoEditor as never,
    deps.directorDeps as never
  );

  return { director, emitter, eventManager, videoEditor, ...deps };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TemplateDirector.config', () => {
  it('applies project config, sets build/assets dirs and logs when no userVideoPaths', () => {
    const { director, project, filesystem, logger } = makeDirector();
    const config: ProjectConfig = { buildDir: '/out', assetsDir: '/media' };
    const descriptor: TemplateDescriptor = { sections: [] };

    const returned = director.config(config, descriptor);

    expect(returned).toBe(director);
    expect(project.config).toBe(config);
    expect(filesystem.setBuildDir).toHaveBeenCalledWith('/out');
    expect(filesystem.setAssetsDir).toHaveBeenCalledWith('/media');
    expect(project.applyDefault).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('TemplateDirector: No userVideoPaths provided in config');
  });

  it('falls back to default build/assets dirs when not provided', () => {
    const { director, filesystem } = makeDirector();

    director.config({}, {});

    expect(filesystem.setBuildDir).toHaveBeenCalledWith('build');
    expect(filesystem.setAssetsDir).toHaveBeenCalledWith('assets');
  });

  it('logs the section list when userVideoPaths are present', () => {
    const { director, logger } = makeDirector();
    const config: ProjectConfig = {
      buildDir: '/out',
      userVideoPaths: { clip1: '/v/1.mp4', clip2: '/v/2.mp4' },
    };

    director.config(config, {});

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('received userVideoPaths with 2 videos'),
      { sections: 'clip1, clip2' }
    );
  });
});

describe('TemplateDirector.compileVideoSegments', () => {
  it('returns null and logs when there are no video segments', async () => {
    const { director, logger, template } = makeDirector();
    template.descriptor = { sections: [{ name: 'title', type: 'intertitle' }] };

    const result = await director.compileVideoSegments();

    expect(result).toBeNull();
    expect(logger.info).toHaveBeenCalledWith('No video segments found in the template to compile.');
  });

  it('returns null when descriptor has no sections at all', async () => {
    const { director, template } = makeDirector();
    template.descriptor = {};

    expect(await director.compileVideoSegments()).toBeNull();
  });

  it('processes video segments and finalizes the compilation', async () => {
    const { director, template, videoEditor, project } = makeDirector();
    const sections: Section[] = [
      { name: 'clipA', type: 'video', options: { duration: 4 } },
      { name: 'clipB', type: 'color_background', options: { duration: 2 } },
    ];
    template.descriptor = { sections };

    const result = await director.compileVideoSegments();

    expect(result).toBe('/build/output.mp4');
    expect(project.buildInfos.totalSegments).toBe(2);
    expect(project.buildInfos.totalLength).toBe(6);
    expect(videoEditor.concat).toHaveBeenCalled();
    expect(videoEditor.finalize).toHaveBeenCalledWith(sections);
  });
});

describe('TemplateDirector.calculateTotalLength', () => {
  it('uses ffmpeg duration for project_video and options.duration otherwise', async () => {
    const { director, project, ffmpeg } = makeDirector();
    ffmpeg.getInfos.mockResolvedValue({ duration: 10, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 44100 });

    const segments: Section[] = [
      { name: 'vid', type: 'project_video', options: {} },
      { name: 'bg', type: 'color_background', options: { duration: 3 } },
      { name: 'noopts', type: 'video' },
    ];

    await director.calculateTotalLength(segments);

    const durMap = project.buildInfos.durations as unknown as Record<string, number>;
    expect(durMap.vid).toBe(10);
    expect(durMap.bg).toBe(3);
    expect(durMap.noopts).toBe(0);
    expect(project.buildInfos.totalLength).toBe(13);
  });
});

describe('TemplateDirector.getVideoSectionDuration / fetchSectionInfos', () => {
  it('throws when section info has no duration', async () => {
    const { director, ffmpeg } = makeDirector();
    ffmpeg.getInfos.mockResolvedValue({ duration: 0, videoCodec: null, audioCodec: null, sampleRate: null });

    await expect(
      director.getVideoSectionDuration({ name: 'v', type: 'project_video' })
    ).rejects.toThrow('No section info found');
  });

  it('throws when ffmpeg reports a null duration for the section', async () => {
    const { director, ffmpeg } = makeDirector();
    ffmpeg.getInfos.mockResolvedValue({ duration: null, videoCodec: null, audioCodec: null, sampleRate: null });

    await expect(
      director.fetchSectionInfos({ name: 'broken', type: 'project_video' })
    ).rejects.toThrow('Duration not found for broken');
  });

  it('uses a verified section-specific user video path', async () => {
    const { director, project, filesystem, ffmpeg } = makeDirector();
    project.config = { userVideoPaths: { clip: '/uploads/clip.mp4' } };
    filesystem.stat.mockResolvedValue(true);

    const infos = await director.fetchSectionInfos({ name: 'clip', type: 'project_video' });

    expect(filesystem.stat).toHaveBeenCalledWith('/uploads/clip.mp4');
    expect(ffmpeg.getInfos).toHaveBeenCalledWith('/uploads/clip.mp4');
    expect(infos.duration).toBe(5);
  });

  it('falls back to the default assets path when the user video cannot be accessed', async () => {
    const { director, project, filesystem, ffmpeg, logger } = makeDirector();
    project.config = { userVideoPaths: { clip: '/uploads/missing.mp4' } };
    filesystem.stat.mockRejectedValue(new Error('not accessible'));

    await director.fetchSectionInfos({ name: 'clip', type: 'project_video' });

    expect(ffmpeg.getInfos).toHaveBeenCalledWith('/assets/videos/clip.mp4');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error accessing section-specific video'),
      expect.objectContaining({ message: 'not accessible' })
    );
  });

  it('ignores userVideoPaths for non project_video sections', async () => {
    const { director, project, ffmpeg } = makeDirector();
    project.config = { userVideoPaths: { clip: '/uploads/clip.mp4' } };

    await director.fetchSectionInfos({ name: 'clip', type: 'video' });

    expect(ffmpeg.getInfos).toHaveBeenCalledWith('/assets/videos/clip.mp4');
  });
});

describe('TemplateDirector.processSingleVideoSegment', () => {
  it('returns true on success and updates progress', async () => {
    const { director, project, emitter } = makeDirector();
    project.buildInfos.totalLength = 10;
    (project.buildInfos.durations as unknown as Record<string, number>).clip = 5;

    const result = await director.processSingleVideoSegment({ name: 'clip', type: 'video' });

    expect(result).toBe(true);
    expect(project.progress).toBeCloseTo(0.5);
    expect(emitter.emit).toHaveBeenCalledWith('compilation-progress', 0.5);
  });

  it('returns false and fires an error when the builder throws', async () => {
    const { director, concreteBuilder, emitter, filesystem } = makeDirector();
    concreteBuilder.buildPart.mockRejectedValue(new Error('build failed'));

    const result = await director.processSingleVideoSegment({ name: 'clip', type: 'video' });

    expect(result).toBe(false);
    expect(emitter.emit).toHaveBeenCalledWith('task-stopped', expect.any(Error));
    expect(filesystem.unlink).toHaveBeenCalled();
  });
});

describe('TemplateDirector.addToQueue / append', () => {
  it('builds, renders, prepares the music track and appends the segment file', async () => {
    const { director, concreteBuilder, musicComposer, filesystem, project } = makeDirector();
    project.buildInfos.fileConcatPath = '/build/segments.list';
    const section: Section = { name: 'clip', type: 'video', options: { duration: 4 } };

    await director.addToQueue(section);

    expect(concreteBuilder.buildPart).toHaveBeenCalledWith(section, project.config);
    expect(concreteBuilder.renderPart).toHaveBeenCalled();
    expect(musicComposer.prepareMusicTrack).toHaveBeenCalledWith(section);
    expect(filesystem.append).toHaveBeenCalledWith(
      '/build/segments.list',
      'file /build/clip_output.mp4\n'
    );
    expect(project.buildInfos.videoInputs).toContain('/build/clip_output.mp4');
  });
});

describe('TemplateDirector.init', () => {
  it('sets the concat path, loads music and writes the segments file', async () => {
    const { director, project, musicComposer, filesystem } = makeDirector();

    await director.init();

    expect(project.buildInfos.fileConcatPath).toBe('/build/segments.list');
    expect(musicComposer.loadMusic).toHaveBeenCalled();
    expect(filesystem.write).toHaveBeenCalledWith('/build/segments.list');
  });
});

describe('TemplateDirector.construct', () => {
  it('returns the final path on a successful full run', async () => {
    const { director, template } = makeDirector();
    template.descriptor = { sections: [{ name: 'clip', type: 'video', options: { duration: 4 } }] };

    const result = await director.construct();

    expect(result).toBe('/build/output.mp4');
  });

  it('returns null and fires an error when init throws', async () => {
    const { director, musicComposer, emitter } = makeDirector();
    musicComposer.loadMusic.mockRejectedValue(new Error('music boom'));

    const result = await director.construct();

    expect(result).toBeNull();
    expect(emitter.emit).toHaveBeenCalledWith('task-stopped', expect.any(Error));
  });

  it('returns null when the build was cancelled mid-flight', async () => {
    const { director, emitter, template, videoEditor } = makeDirector();
    template.descriptor = { sections: [{ name: 'clip', type: 'video', options: { duration: 4 } }] };

    // Simulate a cancellation event before constructing
    emitter.handlers['task-cancelled']?.();

    const result = await director.construct();

    expect(result).toBeNull();
    // finalize/concat must be skipped once the build is stopped
    expect(videoEditor.concat).not.toHaveBeenCalled();
  });
});

describe('TemplateDirector.fireError', () => {
  it('serializes non-Error values and emits task-stopped', async () => {
    const { director, emitter, logger } = makeDirector();

    director.fireError({ code: 'X' });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('{"code":"X"}'));
    expect(emitter.emit).toHaveBeenCalledWith('task-stopped', { code: 'X' });
  });
});
