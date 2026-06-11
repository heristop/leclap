import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import Template from '@/core/models/Template';
import Project from '@/core/models/Project';
import Segment from '@/core/models/Segment';
import defaultConfig from '@/core/default.config';

// A minimal descriptor that satisfies TemplateDescriptorSchema (global? + sections?).
const validDescriptor = {
  global: { orientation: 'landscape' as const },
  sections: [
    {
      name: 'main',
      type: 'video' as const,
      options: { duration: 5 },
    },
  ],
};

describe('Template', () => {
  let template: Template;

  beforeEach(() => {
    template = new Template();
  });

  it('starts with an empty descriptor and empty asset buckets', () => {
    expect(template.descriptor).toEqual({});
    expect(template.assets).toEqual({ fonts: {}, musics: {}, inputs: [] });
  });

  describe('init / clean', () => {
    it('resets assets back to empty buckets', () => {
      template.assets.fonts = { Roboto: '/fonts/roboto.ttf' };
      template.assets.inputs = ['something'] as unknown as [];

      template.init();

      expect(template.assets).toEqual({ fonts: {}, musics: {}, inputs: [] });
    });

    it('clean() delegates to init() and resets assets', () => {
      template.assets.musics = { theme: '/m.mp3' };

      template.clean();

      expect(template.assets).toEqual({ fonts: {}, musics: {}, inputs: [] });
    });
  });

  describe('setDescriptor', () => {
    it('stores the descriptor and returns a successful validation result for valid input', () => {
      const result = template.setDescriptor(validDescriptor);

      expect(result.success).toBe(true);
      expect(template.descriptor).toEqual(validDescriptor);
    });

    it('does not mutate the descriptor and returns failure for invalid input', () => {
      const result = template.setDescriptor(42);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(template.descriptor).toEqual({});
    });

    it('accepts an empty object as a valid descriptor', () => {
      const result = template.setDescriptor({});

      expect(result.success).toBe(true);
      expect(template.descriptor).toEqual({});
    });
  });

  describe('validateDescriptor', () => {
    it('validates the currently stored descriptor', () => {
      template.setDescriptor(validDescriptor);

      const result = template.validateDescriptor();

      expect(result.success).toBe(true);
    });

    it('reports success for the default empty descriptor', () => {
      expect(template.validateDescriptor().success).toBe(true);
    });
  });

  describe('loadFromJSON', () => {
    it('parses and stores a descriptor from a valid JSON string', () => {
      const result = template.loadFromJSON(JSON.stringify(validDescriptor));

      expect(result.success).toBe(true);
      expect(template.descriptor).toEqual(validDescriptor);
    });

    it('returns failure and leaves descriptor untouched for malformed JSON', () => {
      const result = template.loadFromJSON('{ not valid json');

      expect(result.success).toBe(false);
      expect(template.descriptor).toEqual({});
    });

    it('returns failure for JSON that is valid but fails schema validation', () => {
      const result = template.loadFromJSON(JSON.stringify(42));

      expect(result.success).toBe(false);
      expect(template.descriptor).toEqual({});
    });
  });
});

describe('Project', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  it('initializes config empty and buildInfos with zeroed counters', () => {
    expect(project.config).toEqual({});
    expect(project.finalVideo).toBe('');
    expect(project.progress).toBe(0);
    expect(project.errors).toEqual([]);
    expect(project.buildInfos).toEqual({
      totalSegments: 0,
      totalLength: 0,
      currentLength: 0,
      currentProgress: 0,
      currentIncrement: 0,
      durations: {},
      videoInputs: [],
      musicInputs: [],
      musicFilters: [],
      fileConcatPath: '',
      musicPath: '',
    });
  });

  describe('init / clean', () => {
    it('resets buildInfos to its initial shape', () => {
      project.buildInfos.totalSegments = 9;
      project.buildInfos.durations = { intro: 1, body: 2, outro: 3 };

      project.init();

      expect(project.buildInfos.totalSegments).toBe(0);
      expect(project.buildInfos.durations).toEqual({});
    });

    it('clean() delegates to init()', () => {
      project.buildInfos.currentProgress = 50;

      project.clean();

      expect(project.buildInfos.currentProgress).toBe(0);
    });
  });

  describe('applyDefault', () => {
    it('fills in every default config block when config is empty', () => {
      project.applyDefault();

      expect(project.config.codecConfig).toEqual({
        videoCodec: defaultConfig.VIDEO_CODEC,
        audioCodec: defaultConfig.AUDIO_CODEC,
      });
      expect(project.config.hardwareConfig).toEqual({
        hwaccel: defaultConfig.HWACCEL,
        preset: defaultConfig.PRESET,
      });
      expect(project.config.audioConfig).toEqual({
        sampleRate: defaultConfig.SAMPLE_RATE,
        channelLayout: defaultConfig.CHANNEL_LAYOUT,
      });
      expect(project.config.videoConfig).toEqual({
        orientation: defaultConfig.ORIENTATION,
        scale: defaultConfig.SCALE,
        setsar: defaultConfig.SETSAR,
      });
      expect(project.config.currentLocale).toBe(defaultConfig.CURRENT_LOCALE);
    });

    it('lets a user-provided nested config block override the defaults entirely', () => {
      project.config = {
        currentLocale: 'fr',
        hardwareConfig: { preset: 'fast' },
        videoConfig: { scale: '1920:1080' },
      };

      project.applyDefault();

      expect(project.config.currentLocale).toBe('fr');
      expect(project.config.hardwareConfig?.preset).toBe('fast');
      // The trailing `...this.config` spread wins, so the user's hardwareConfig
      // object replaces the default-merged one wholesale (hwaccel not present).
      expect(project.config.hardwareConfig?.hwaccel).toBeUndefined();
      expect(project.config.videoConfig?.scale).toBe('1920:1080');
      expect(project.config.videoConfig?.orientation).toBeUndefined();
      // Blocks the user did NOT provide still receive their full defaults.
      expect(project.config.audioConfig).toEqual({
        sampleRate: defaultConfig.SAMPLE_RATE,
        channelLayout: defaultConfig.CHANNEL_LAYOUT,
      });
      expect(project.config.codecConfig).toEqual({
        videoCodec: defaultConfig.VIDEO_CODEC,
        audioCodec: defaultConfig.AUDIO_CODEC,
      });
    });

    it('keeps an explicitly provided currentLocale via the nullish branch', () => {
      project.config = { currentLocale: 'es' };

      project.applyDefault();

      expect(project.config.currentLocale).toBe('es');
    });
  });
});

describe('Segment', () => {
  it('initializes all collection and counter fields to empty defaults', () => {
    const segment = new Segment();

    expect(segment.currentSection).toBeUndefined();
    expect(segment.filtersList).toEqual([]);
    expect(segment.filtersMapList).toEqual([]);
    expect(segment.mapsList).toEqual([]);
    expect(segment.assetsDir).toBe('');
    expect(segment.fontsDir).toBe('');
    expect(segment.animationsDir).toBe('');
    expect(segment.tempFonts).toEqual([]);
    expect(segment.inputsAsset).toEqual([]);
    expect(segment.inputsMapCount).toBe(0);
  });

  it('allows mutating its public fields', () => {
    const segment = new Segment();

    segment.assetsDir = '/assets';
    segment.inputsMapCount = 3;
    segment.filtersList.push('scale=1280:720');

    expect(segment.assetsDir).toBe('/assets');
    expect(segment.inputsMapCount).toBe(3);
    expect(segment.filtersList).toEqual(['scale=1280:720']);
  });
});
