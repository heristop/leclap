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
      sourceHasAudio: {} as Record<string, boolean>,
      videoInputs: [] as string[],
      musicInputs: [] as string[],
      musicFilters: [] as string[],
      fileConcatPath: '',
      musicPath: '',
      transitions: [] as Array<{ type: string; duration: number }>,
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

  const segmentHandle = { getCommand: () => '-y out.mp4', destination: '/build/seg_output.mp4' };
  const concreteBuilder = {
    build: vi.fn(async (_section: Section, _projectConfig: ProjectConfig) => ({ segment: segmentHandle, ok: true })),
    render: vi.fn(async (_segment: unknown, _section: Section) => undefined),
  };
  const musicComposer = {
    loadMusic: vi.fn(async () => undefined),
    prepareMusicTrack: vi.fn(),
    loopMusic: vi.fn(async () => undefined),
    appendMusic: vi.fn(async () => undefined),
    normalizeAudio: vi.fn(async () => undefined),
    hasNormalization: vi.fn(() => false),
  };
  const ffmpeg = {
    supportsConcurrentExecute: false,
    execute: vi.fn(async () => ({ rc: 0 })),
    getInfos: vi.fn(
      async (): Promise<FFMpegInfos> => ({ duration: 5, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 44100 })
    ),
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
    concat: vi.fn(async () => {
      deps.project.finalVideo = '/build/output.mp4';

      return '/build/output.mp4';
    }),
    assembleWithTransitions: vi.fn(async () => {
      deps.project.finalVideo = '/build/output.mp4';

      return '/build/output.mp4';
    }),
    finalize: vi.fn(async () => undefined),
  };

  const director = new TemplateDirector(eventManager as never, videoEditor as never, deps.directorDeps as never);

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

  it('swaps the output scale to portrait once for a portrait template', () => {
    const { director, project } = makeDirector();
    const config: ProjectConfig = { videoConfig: { scale: '1280:720' } };
    const descriptor = { global: { orientation: 'portrait' }, sections: [] } as TemplateDescriptor;

    director.config(config, descriptor);

    expect(project.config.videoConfig?.scale).toBe('720:1280');
  });

  it('leaves the output scale untouched for a landscape template', () => {
    const { director, project } = makeDirector();
    const config: ProjectConfig = { videoConfig: { scale: '1280:720' } };

    director.config(config, { global: { orientation: 'landscape' }, sections: [] } as TemplateDescriptor);

    expect(project.config.videoConfig?.scale).toBe('1280:720');
  });

  it('forces the output scale to the 1080x1080 square preset for a square template', () => {
    const { director, project } = makeDirector();
    const config: ProjectConfig = { videoConfig: { scale: '1280:720' } };
    const descriptor = { global: { orientation: 'square' }, sections: [] } as TemplateDescriptor;

    director.config(config, descriptor);

    expect(project.config.videoConfig?.scale).toBe('1080:1080');
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
      expect.stringContaining('received userVideoPaths for sections: clip1, clip2')
    );
  });

  it('expands `partial` ref sections so they survive compileVideoSegments (not dropped)', () => {
    const { director, template } = makeDirector();
    // `compileVideoSegments` keeps only real rendering types; a `type:'partial'` section reaching it
    // unexpanded is silently filtered out — which is exactly how the flash-card partial went missing.
    const descriptor: TemplateDescriptor = {
      partials: [
        {
          id: 'flash-card',
          sections: [{ name: 'flash', type: 'color_background', title: { en: '{{ optionA }} vs {{ optionB }}' } }],
        },
      ],
      sections: [
        {
          type: 'partial',
          ref: 'flash-card',
          prefix: 'q1_',
          variables: { optionA: 'Tea', optionB: 'Coffee', index: '1' },
        },
        { name: 'video_1', type: 'project_video' },
      ],
    } as unknown as TemplateDescriptor;

    director.config({}, descriptor);

    const sections = (template.descriptor.sections ?? []) as Array<{ type?: string; name?: string }>;
    // The partial ref is replaced by the partial's real `color_background` section (prefixed name).
    expect(sections.some((s) => s.type === 'partial')).toBe(false);
    expect(sections.some((s) => s.type === 'color_background')).toBe(true);
    expect(sections.some((s) => s.name === 'q1_flash')).toBe(true);
    // The sibling project_video is untouched.
    expect(sections.some((s) => s.name === 'video_1')).toBe(true);
    // The ref variables are substituted into the expanded section.
    expect(JSON.stringify(sections)).toContain('Tea');
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

  it('returns null without throwing when `sections` is a malformed non-array', async () => {
    // A malformed descriptor (e.g. `sections: 'nope'`) must not crash `allSections.filter` — it
    // normalizes to "no sections" and resolves null, so an invalid template is rejected cleanly.
    const { director, template } = makeDirector();
    template.descriptor = { sections: 'nope' } as never;

    await expect(director.compileVideoSegments()).resolves.toBeNull();
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
    expect(videoEditor.finalize).toHaveBeenCalledWith(sections, undefined);
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

    const durMap = project.buildInfos.durations;
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

    await expect(director.getVideoSectionDuration({ name: 'v', type: 'project_video' })).rejects.toThrow(
      'No section info found'
    );
  });

  it('throws when ffmpeg reports a null duration for the section', async () => {
    const { director, ffmpeg } = makeDirector();
    ffmpeg.getInfos.mockResolvedValue({ duration: null, videoCodec: null, audioCodec: null, sampleRate: null });

    await expect(director.fetchSectionInfos({ name: 'broken', type: 'project_video' })).rejects.toThrow(
      'Duration not found for broken'
    );
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
    project.buildInfos.durations.clip = 5;

    const result = await director.processSingleVideoSegment({ name: 'clip', type: 'video' });

    expect(result).toBe(true);
    expect(project.progress).toBeCloseTo(0.5);
    expect(emitter.emit).toHaveBeenCalledWith('compilation-progress', 0.5);
  });

  it('returns false and fires an error when the builder throws', async () => {
    const { director, concreteBuilder, emitter, filesystem } = makeDirector();
    concreteBuilder.build.mockRejectedValue(new Error('build failed'));

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

    expect(concreteBuilder.build).toHaveBeenCalledWith(section, project.config);
    expect(concreteBuilder.render).toHaveBeenCalled();
    expect(musicComposer.prepareMusicTrack).toHaveBeenCalledWith(section);
    expect(filesystem.append).toHaveBeenCalledWith('/build/segments.list', 'file /build/clip_output.mp4\n');
    expect(project.buildInfos.videoInputs).toContain('/build/clip_output.mp4');
  });
});

describe('TemplateDirector.processVideoSegments concurrency', () => {
  const sections: Section[] = [
    { name: 'a', type: 'video', options: { duration: 2 } },
    { name: 'b', type: 'video', options: { duration: 2 } },
    { name: 'c', type: 'video', options: { duration: 2 } },
  ];

  function seedDurations(project: ReturnType<typeof makeProject>) {
    project.buildInfos.totalLength = 6;
    project.buildInfos.durations = { a: 2, b: 2, c: 2 };
  }

  it('renders serially when the adapter does not support concurrent execute', async () => {
    const { director, project, ffmpeg, logger } = makeDirector();
    ffmpeg.supportsConcurrentExecute = false;
    project.config.hardwareConfig = { maxRenderConcurrency: 4 };
    seedDurations(project);

    await director.processVideoSegments(sections);

    expect(logger.info).toHaveBeenCalledWith('[TemplateDirection] Render concurrency: 1');
  });

  it('builds every segment before rendering and appends in input order under concurrency', async () => {
    const { director, project, ffmpeg, concreteBuilder, filesystem } = makeDirector();
    ffmpeg.supportsConcurrentExecute = true;
    project.config.hardwareConfig = { maxRenderConcurrency: 2 };
    seedDurations(project);

    const events: string[] = [];
    concreteBuilder.build.mockImplementation(async (section: Section) => {
      events.push(`build:${section.name}`);

      return { segment: { getCommand: () => '', destination: `/build/${section.name}.mp4` }, ok: true };
    });
    // Make 'a' render slowest so completion order differs from input order.
    concreteBuilder.render.mockImplementation(async (_segment: unknown, section: Section) => {
      await new Promise((resolve) => setTimeout(resolve, section.name === 'a' ? 15 : 1));
      events.push(`render:${section.name}`);
    });

    await director.processVideoSegments(sections);

    const firstRender = events.findIndex((e) => e.startsWith('render:'));
    expect(events.slice(0, firstRender)).toEqual(['build:a', 'build:b', 'build:c']);
    expect(project.buildInfos.videoInputs).toEqual([
      '/build/a_output.mp4',
      '/build/b_output.mp4',
      '/build/c_output.mp4',
    ]);
    expect(filesystem.append.mock.calls.map((c: unknown[]) => c[1])).toEqual([
      'file /build/a_output.mp4\n',
      'file /build/b_output.mp4\n',
      'file /build/c_output.mp4\n',
    ]);
  });

  it('does not render when a build fails (the pool never starts)', async () => {
    const { director, project, ffmpeg, concreteBuilder } = makeDirector();
    ffmpeg.supportsConcurrentExecute = true;
    project.config.hardwareConfig = { maxRenderConcurrency: 3 };
    seedDurations(project);

    concreteBuilder.build.mockImplementation(async (section: Section) => {
      if (section.name === 'b') {
        throw new Error('build boom');
      }

      return { segment: { getCommand: () => '', destination: `/build/${section.name}.mp4` }, ok: true };
    });

    await expect(director.processVideoSegments(sections)).rejects.toThrow('build boom');
    expect(concreteBuilder.render).not.toHaveBeenCalled();
  });

  it('falls back to serial rendering when segments share an output path', async () => {
    const { director, project, ffmpeg, logger } = makeDirector();
    ffmpeg.supportsConcurrentExecute = true;
    project.config.hardwareConfig = { maxRenderConcurrency: 3 };
    seedDurations(project);
    // The default build mock returns the same handle (same destination) for every section, so the
    // duplicate-output guard must engage and render serially rather than overwrite concurrently.

    await director.processVideoSegments(sections);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Duplicate segment output paths'));
    expect(project.buildInfos.videoInputs).toEqual([
      '/build/a_output.mp4',
      '/build/b_output.mp4',
      '/build/c_output.mp4',
    ]);
  });

  it('reaches full progress after a concurrent render', async () => {
    const { director, project, ffmpeg } = makeDirector();
    ffmpeg.supportsConcurrentExecute = true;
    project.config.hardwareConfig = { maxRenderConcurrency: 3 };
    seedDurations(project);

    await director.processVideoSegments(sections);

    expect(project.progress).toBeCloseTo(1);
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

describe('TemplateDirector.buildTransitions + totalLength', () => {
  it('builds per-boundary transitions from section + global and shortens totalLength by non-cut durations', async () => {
    const { director, template, project } = makeDirector();
    const sections: Section[] = [
      { name: 's1', type: 'video', options: { duration: 4 }, transition: { type: 'wipeleft', duration: 0.5 } },
      { name: 's2', type: 'video', options: { duration: 3 } },
      { name: 's3', type: 'video', options: { duration: 5 } },
    ];
    template.descriptor = { global: { transition: { type: 'dissolve', duration: 0.4 } }, sections };

    await director.compileVideoSegments();

    expect(project.buildInfos.transitions).toEqual([
      { type: 'wipeleft', duration: 0.5 },
      { type: 'dissolve', duration: 0.4 },
    ]);
    // Σd (12) − non-cut durations (0.9)
    expect(project.buildInfos.totalLength).toBeCloseTo(11.1);
  });

  it('produces all-cut boundaries and unchanged totalLength when no transitions are declared', async () => {
    const { director, template, project, videoEditor } = makeDirector();
    const sections: Section[] = [
      { name: 's1', type: 'video', options: { duration: 4 } },
      { name: 's2', type: 'video', options: { duration: 2 } },
    ];
    template.descriptor = { sections };

    await director.compileVideoSegments();

    expect(project.buildInfos.transitions).toEqual([{ type: 'cut', duration: 0 }]);
    expect(project.buildInfos.totalLength).toBe(6);
    expect(videoEditor.concat).toHaveBeenCalled();
    expect(videoEditor.assembleWithTransitions).not.toHaveBeenCalled();
  });

  it('computes boundaries over rendering sections only, skipping interleaved form/music sections', async () => {
    const { director, template, project } = makeDirector();
    const sections: Section[] = [
      { name: 's1', type: 'video', options: { duration: 4 }, transition: { type: 'fade', duration: 0.5 } },
      { name: 'intro', type: 'form' },
      { name: 's2', type: 'color_background', options: { duration: 2 } },
      { name: 'bg-music', type: 'music' },
      { name: 's3', type: 'image_background', options: { duration: 3 } },
    ];
    template.descriptor = { sections };

    await director.compileVideoSegments();

    // 3 rendering sections → 2 boundaries; only s1 declares a transition.
    expect(project.buildInfos.transitions).toEqual([
      { type: 'fade', duration: 0.5 },
      { type: 'cut', duration: 0 },
    ]);
  });
});

describe('TemplateDirector.finalizeCompilation path selection', () => {
  it('uses assembleWithTransitions with the ordered segment files when a boundary is non-cut', async () => {
    const { director, template, videoEditor, project } = makeDirector();
    const sections: Section[] = [
      { name: 's1', type: 'video', options: { duration: 4 }, transition: { type: 'wipeleft', duration: 0.5 } },
      { name: 's2', type: 'video', options: { duration: 3 } },
    ];
    template.descriptor = { sections };

    await director.compileVideoSegments();

    expect(videoEditor.concat).not.toHaveBeenCalled();
    expect(videoEditor.assembleWithTransitions).toHaveBeenCalledWith(
      ['/build/s1_output.mp4', '/build/s2_output.mp4'],
      [{ type: 'wipeleft', duration: 0.5 }]
    );
    expect(project.buildInfos.videoInputs).toEqual(['/build/s1_output.mp4', '/build/s2_output.mp4']);
  });

  it('calls normalizeAudio with the final path when music is disabled', async () => {
    const { director, template, musicComposer } = makeDirector();
    const sections: Section[] = [
      { name: 's1', type: 'video', options: { duration: 4 } },
      { name: 's2', type: 'video', options: { duration: 2 } },
    ];
    template.descriptor = { global: { musicEnabled: false, audio: { normalize: 'loudnorm' } }, sections };

    await director.compileVideoSegments();

    expect(musicComposer.normalizeAudio).toHaveBeenCalledWith('/build/output.mp4');
  });

  it('does not call normalizeAudio when music is enabled', async () => {
    const { director, template, musicComposer } = makeDirector();
    const sections: Section[] = [
      { name: 's1', type: 'video', options: { duration: 4 } },
      { name: 's2', type: 'video', options: { duration: 2 } },
    ];
    template.descriptor = { global: { musicEnabled: true }, sections };

    await director.compileVideoSegments();

    expect(musicComposer.normalizeAudio).not.toHaveBeenCalled();
  });
});

describe('TemplateDirector.finalizeCompilation concat fold', () => {
  const cut = [{ type: 'cut', duration: 0 }];

  it('folds concat into the music pass (no transitions/animations, music on)', async () => {
    const { director, project, template, videoEditor, musicComposer } = makeDirector();
    template.descriptor = { global: { musicEnabled: true }, sections: [] } as never;
    project.buildInfos.musicPath = '/m/track.mp3';
    project.buildInfos.fileConcatPath = '/build/segments.list';
    project.buildInfos.transitions = cut;

    await director.finalizeCompilation([
      { name: 'a', type: 'video' },
      { name: 'b', type: 'video' },
    ] as never);

    expect(videoEditor.concat).not.toHaveBeenCalled();
    expect(videoEditor.assembleWithTransitions).not.toHaveBeenCalled();
    expect(videoEditor.finalize).toHaveBeenCalledWith(expect.anything(), {
      kind: 'concat',
      listPath: '/build/segments.list',
    });
    expect(musicComposer.normalizeAudio).not.toHaveBeenCalled();
    expect(project.finalVideo).toBe('/build/output.mp4');
  });

  it('does NOT fold when a transition is present', async () => {
    const { director, template, videoEditor, project } = makeDirector();
    template.descriptor = { global: { musicEnabled: true }, sections: [] } as never;
    project.buildInfos.musicPath = '/m/track.mp3';
    project.buildInfos.videoInputs = ['/build/a_output.mp4', '/build/b_output.mp4'];
    project.buildInfos.transitions = [{ type: 'fade', duration: 1 }];

    await director.finalizeCompilation([
      { name: 'a', type: 'video' },
      { name: 'b', type: 'video' },
    ] as never);

    expect(videoEditor.assembleWithTransitions).toHaveBeenCalled();
    expect(videoEditor.finalize).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it('does NOT fold when global.animations are present (concat then finalize)', async () => {
    const { director, template, videoEditor, project } = makeDirector();
    template.descriptor = { global: { musicEnabled: true, animations: [{ url: 'x' }] }, sections: [] } as never;
    project.buildInfos.musicPath = '/m/track.mp3';
    project.buildInfos.transitions = cut;

    await director.finalizeCompilation([{ name: 'a', type: 'video' }] as never);

    expect(videoEditor.concat).toHaveBeenCalled();
    expect(videoEditor.finalize).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it('folds on a virtual-filesystem (WASM) adapter too', async () => {
    // Platform-agnostic: FFmpegWasmAdapter.execute bridges the concat segments + music into MEMFS,
    // so the director must not special-case WASM.
    const { director, template, videoEditor, project, ffmpeg } = makeDirector();
    (ffmpeg as Record<string, unknown>).usesVirtualFilesystem = true;
    template.descriptor = { global: { musicEnabled: true }, sections: [] } as never;
    project.buildInfos.musicPath = '/m/track.mp3';
    project.buildInfos.fileConcatPath = '/build/segments.list';
    project.buildInfos.transitions = cut;

    await director.finalizeCompilation([{ name: 'a', type: 'video' }] as never);

    expect(videoEditor.concat).not.toHaveBeenCalled();
    expect(videoEditor.finalize).toHaveBeenCalledWith(expect.anything(), {
      kind: 'concat',
      listPath: '/build/segments.list',
    });
  });

  it('folds concat into normalize on the no-music + normalize path', async () => {
    const { director, template, videoEditor, musicComposer, project } = makeDirector();
    musicComposer.hasNormalization.mockReturnValue(true);
    template.descriptor = { global: { audio: { normalize: 'loudnorm' } }, sections: [] } as never;
    project.buildInfos.fileConcatPath = '/build/segments.list';
    project.buildInfos.transitions = cut;

    await director.finalizeCompilation([{ name: 'a', type: 'video' }] as never);

    expect(videoEditor.concat).not.toHaveBeenCalled();
    expect(musicComposer.normalizeAudio).toHaveBeenCalledWith('/build/output.mp4', {
      kind: 'concat',
      listPath: '/build/segments.list',
    });
    // finalize still runs for the finalize event + cleanup, with no folded source
    expect(videoEditor.finalize).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it('does NOT fold when FVC_DISABLE_CONCAT_FOLD is set (bench/debug escape hatch)', async () => {
    const prev = process.env.FVC_DISABLE_CONCAT_FOLD;
    process.env.FVC_DISABLE_CONCAT_FOLD = '1';
    const { director, template, videoEditor, project } = makeDirector();
    template.descriptor = { global: { musicEnabled: true }, sections: [] } as never;
    project.buildInfos.musicPath = '/m/track.mp3';
    project.buildInfos.fileConcatPath = '/build/segments.list';
    project.buildInfos.transitions = cut;

    await director.finalizeCompilation([{ name: 'a', type: 'video' }] as never);

    expect(videoEditor.concat).toHaveBeenCalled();
    expect(videoEditor.finalize).toHaveBeenCalledWith(expect.anything(), undefined);

    if (prev === undefined) {
      delete process.env.FVC_DISABLE_CONCAT_FOLD;
      return;
    }

    process.env.FVC_DISABLE_CONCAT_FOLD = prev;
  });
});

describe('TemplateDirector.config descriptor cloning', () => {
  it('deep-clones the descriptor so a second compile does not double-apply section filters', () => {
    const { director, template } = makeDirector();
    const descriptor: TemplateDescriptor = {
      sections: [{ name: 's1', type: 'video', options: { duration: 4 }, filters: [{ type: 'eq' }] }],
    };

    director.config({}, descriptor);
    const firstCount = template.descriptor.sections?.[0]?.filters?.length;

    // Simulate an in-place build mutation (sugar injection prepends preset filters).
    template.descriptor.sections?.[0]?.filters?.unshift({ type: 'scale' });

    director.config({}, descriptor);
    const secondCount = template.descriptor.sections?.[0]?.filters?.length;

    expect(firstCount).toBe(1);
    expect(secondCount).toBe(1);
    // Original descriptor object must be untouched by the build mutation.
    expect(descriptor.sections?.[0]?.filters?.length).toBe(1);
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
