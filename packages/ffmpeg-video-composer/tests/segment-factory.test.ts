import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { container } from 'tsyringe';
import SegmentFactory from '@/editor/factories/SegmentFactory';
import Video from '@/editor/segments/VideoSegment';
import ProjectVideo from '@/editor/segments/ProjectVideoSegment';
import ImageBackground from '@/editor/segments/ImageBackgroundSegment';
import ColorBackground from '@/editor/segments/ColorBackgroundSegment';
import Project from '@/core/models/Project';
import type { Section, ProjectConfig } from '@/core/types';

// Register the DI tokens that SegmentBuilder (the base class) injects, with
// lightweight stubs. We override 'SegmentManagersBag' with a value so we don't
// need to register every individual manager token.
function registerStubs(project: Project) {
  const template: any = {
    descriptor: { global: {} },
    assets: { fonts: {}, inputs: [] },
  };
  const segment: any = {};
  const managers = {
    assetManager: {},
    variableManager: {},
    mapManager: {},
    filterManager: {},
    formattersManager: {},
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
    filesystemAdapter: {
      getSource: (name?: string) => (name ? `/tmp/${name}.mp4` : '/tmp/source.mp4'),
      getDestination: () => '/tmp/out.mp4',
      setSegment: vi.fn(),
    },
  };

  container.registerInstance('project', project);
  container.registerInstance('template', template);
  container.registerInstance('segment', segment);
  container.registerInstance('SegmentManagersBag', managers as never);
}

const baseConfig: ProjectConfig = {
  audioConfig: { channelLayout: 'stereo', sampleRate: 44100 },
  hardwareConfig: { preset: 'medium' },
  videoConfig: { scale: '1280:720', setsar: '1/1' },
};

function makeSection(type: string, name = 'main'): Section {
  return { name, type, options: { duration: 5 } } as unknown as Section;
}

describe('SegmentFactory', () => {
  let project: Project;

  beforeEach(() => {
    container.reset();
    project = new Project();
    project.config = { ...baseConfig };
    registerStubs(project);
  });

  it('throws for an unsupported segment type (no container access needed)', () => {
    const factory = new SegmentFactory(baseConfig);

    expect(() => factory.create(makeSection('totally_unknown'))).toThrow('Unsupported segment type: totally_unknown');
  });

  it('resolves a Video segment for a "video" section and hydrates it', () => {
    const factory = new SegmentFactory(baseConfig);

    const segment = factory.create(makeSection('video'));

    expect(segment).toBeInstanceOf(Video);
  });

  it('resolves an ImageBackground segment for an "image_background" section', () => {
    const factory = new SegmentFactory(baseConfig);

    const segment = factory.create(makeSection('image_background'));

    expect(segment).toBeInstanceOf(ImageBackground);
  });

  it('resolves a ColorBackground segment for a "color_background" section', () => {
    const factory = new SegmentFactory(baseConfig);

    const segment = factory.create(makeSection('color_background'));

    expect(segment).toBeInstanceOf(ColorBackground);
  });

  it('resolves a ProjectVideo segment and assigns the factory projectConfig onto its Project', () => {
    const factoryConfig: ProjectConfig = {
      ...baseConfig,
      userVideoPaths: { main: '/videos/main.mp4' },
    };
    const factory = new SegmentFactory(factoryConfig);

    const segment = factory.create(makeSection('project_video'));

    expect(segment).toBeInstanceOf(ProjectVideo);
    // The factory copies its projectConfig onto the resolved segment's Project model.
    expect(segment.getProject().config).toBe(factoryConfig);
    expect(segment.getProject().config.userVideoPaths).toEqual({ main: '/videos/main.mp4' });
  });

  it('returns the hydrated segment (hydrate sets currentSection on the shared segment model)', () => {
    const factory = new SegmentFactory(baseConfig);
    const section = makeSection('video', 'intro');

    const segment = factory.create(section);

    // hydrate() returns the builder itself and records the section on the segment model.
    expect(segment.getCommand).toBeTypeOf('function');
    expect((segment as any).segment.currentSection).toBe(section);
  });
});
