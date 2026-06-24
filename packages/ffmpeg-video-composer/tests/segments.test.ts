import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import Video from '@/editor/segments/VideoSegment';
import ProjectVideo from '@/editor/segments/ProjectVideoSegment';
import ImageBackground from '@/editor/segments/ImageBackgroundSegment';
import ColorBackground from '@/editor/segments/ColorBackgroundSegment';
import type { SectionOptions } from '@/core/types';

type SegmentClass = typeof Video | typeof ProjectVideo | typeof ImageBackground | typeof ColorBackground;

interface BuildOverrides {
  projectConfig?: Record<string, unknown>;
  templateDescriptor?: Record<string, unknown>;
  options?: SectionOptions;
  sectionName?: string;
  sources?: string[];
  hwaccelArg?: string;
  filters?: string;
  source?: string;
  getSource?: (name?: string) => string;
}

// Build a segment in isolation (bypassing the DI container), mirroring the
// approach in tests/video-segment.test.ts: set only the protected fields that
// the overridden configure() reads, then assert on the assembled command.
function buildSegment(SegmentCtor: SegmentClass, overrides: BuildOverrides = {}) {
  const project: any = {
    config: {
      audioConfig: { channelLayout: 'stereo', sampleRate: 44100 },
      hardwareConfig: { preset: 'medium' },
      videoConfig: { scale: '1280:720', setsar: '1/1' },
      ...overrides.projectConfig,
    },
    buildInfos: { sourceHasAudio: {} },
  };
  const template: any = {
    descriptor: { global: overrides.templateDescriptor ?? {} },
    assets: { fonts: {}, inputs: [] },
  };
  const segment: any = {};
  const logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn() };
  const managers: any = {
    assetManager: {},
    variableManager: {},
    mapManager: {},
    filterManager: {},
    formattersManager: {},
    logger,
    filesystemAdapter: {
      getSource: overrides.getSource ?? ((name?: string) => (name ? `/tmp/${name}.mp4` : '/tmp/source.mp4')),
      getDestination: () => '/tmp/out.mp4',
      setSegment() {},
    },
  };

  const seg: any = new SegmentCtor(project, template, segment, managers);
  seg.section = {
    name: overrides.sectionName ?? 'main',
    type: 'video',
    options: overrides.options ?? { duration: 5 },
  };
  seg.source = overrides.source ?? '/tmp/source.mp4';
  seg.sources = overrides.sources ?? [];
  seg.destination = '/tmp/out.mp4';
  seg.filters = overrides.filters ?? '';
  seg.hwaccelArg = overrides.hwaccelArg ?? '';

  return { seg, logger, project, template };
}

describe('SegmentBuilder constructor (via concrete segment)', () => {
  // Output orientation is resolved once in TemplateDirector.config, so the segment constructor never
  // swaps the scale — see template-director.test.ts for the portrait swap.
  it('leaves the scale untouched for a portrait template (swap handled by the director)', () => {
    const { seg } = buildSegment(Video, {
      templateDescriptor: { orientation: 'portrait' },
      projectConfig: { videoConfig: { scale: '1280:720', setsar: '1/1' } },
    });

    expect(seg.getProject().config.videoConfig.scale).toBe('1280:720');
  });

  it('leaves scale untouched when orientation is not portrait', () => {
    const { seg } = buildSegment(Video, {
      templateDescriptor: { orientation: 'landscape' },
    });

    expect(seg.getProject().config.videoConfig.scale).toBe('1280:720');
  });

  it('does not throw when portrait orientation has no parseable scale', () => {
    const { seg } = buildSegment(Video, {
      templateDescriptor: { orientation: 'portrait' },
      projectConfig: { videoConfig: {} },
    });

    // scale was undefined → split yields undefined parts → no reassignment
    expect(seg.getProject().config.videoConfig.scale).toBeUndefined();
  });
});

describe('VideoSegment.configure', () => {
  it('drives from the primary source when neither videoUrl nor useVideoSection is set', () => {
    const { seg } = buildSegment(Video, { options: { duration: 5 } });

    seg.configure();
    const command = seg.getCommand();

    expect(command).toContain('-i /tmp/source.mp4');
    expect(command).toContain('/tmp/out.mp4');
    expect(command).toContain('-map 0:a?');
    // includes the blank-audio prelude by default (mute not disabled)
    expect(command).toContain('anullsrc');
    expect(command).toContain('-t 5');
    expect(command).toContain('-preset medium');
  });

  it('omits the blank audio prelude when muteSection is explicitly false', () => {
    const { seg } = buildSegment(Video, { options: { duration: 5, muteSection: false } });

    seg.configure();
    const command = seg.getCommand();

    expect(command).not.toContain('anullsrc');
    expect(command.startsWith(' -y ')).toBe(true);
  });

  it('uses a video URL as second input when videoUrl is set', () => {
    const { seg } = buildSegment(Video, {
      options: { duration: 8, videoUrl: 'https://example.com/v.mp4' },
      sources: ['-i /tmp/clip.mp4'],
    });

    seg.configure();
    const command = seg.getCommand();

    expect(command).toContain('-i /tmp/clip.mp4');
    expect(command).toContain('-t 8');
    // primary -i <source> form is NOT used in the videoUrl branch
    expect(command).not.toContain('-i /tmp/source.mp4');
    expect(command).toContain('/tmp/out.mp4');
  });

  it('uses a referenced project video section via filesystemAdapter.getSource', () => {
    const getSource = vi.fn((name?: string) => (name ? `/resolved/${name}.mp4` : '/tmp/source.mp4'));
    const { seg } = buildSegment(Video, {
      options: { duration: 4, useVideoSection: 'intro' },
      getSource,
    });

    seg.configure();
    const command = seg.getCommand();

    expect(getSource).toHaveBeenCalledWith('intro');
    expect(command).toContain('-i /resolved/intro.mp4');
    expect(command).toContain('-t 4');
    expect(command).toContain('/tmp/out.mp4');
  });

  it('includes the hwaccel argument when present', () => {
    const { seg } = buildSegment(Video, {
      options: { duration: 5 },
      hwaccelArg: '-hwaccel cuda',
    });

    seg.configure();

    expect(seg.getCommand()).toContain('-hwaccel cuda');
  });

  it('falls back to the medium preset when hardwareConfig.preset is undefined', () => {
    const { seg } = buildSegment(Video, {
      options: { duration: 5 },
      projectConfig: { hardwareConfig: {}, videoConfig: { scale: '1280:720' } },
    });

    seg.configure();

    expect(seg.getCommand()).toContain('-preset medium');
  });

  it('uses the WASM-safe encoding params when running in a browser-like env (window defined)', () => {
    // Line 18: `const isWasm = typeof window !== 'undefined'`.
    // In node `window` is undefined (native branch). Define it to exercise the
    // WASM encoding-params branch, then restore so other tests stay on native.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
    (globalThis as { window?: unknown }).window = {};
    try {
      const { seg } = buildSegment(Video, { options: { duration: 5 } });

      seg.configure();
      const command = seg.getCommand();

      // WASM branch: simpler/faster encoding to avoid memory issues
      expect(command).toContain('-crf 28');
      expect(command).toContain('-preset ultrafast');
      // native-only flags must be absent on the WASM branch
      expect(command).not.toContain('-b:v 12M');
      expect(command).not.toContain('-profile:v high');
    } finally {
      // Restore the original window descriptor, or remove the stub if there was none
      delete (globalThis as { window?: unknown }).window;

      if (original) {
        Object.defineProperty(globalThis, 'window', original);
      }
    }
  });
});

describe('ProjectVideoSegment.configure', () => {
  it('builds a command from this.source with the configured preset and maps audio', () => {
    const { seg, logger } = buildSegment(ProjectVideo, {
      sectionName: 'clip',
      options: { duration: 6 },
      source: '/videos/clip.mp4',
    });

    seg.configure();
    const command = seg.getCommand();

    expect(command).toContain('-i /videos/clip.mp4');
    expect(command).toContain('-t 6');
    expect(command).toContain('-preset medium');
    expect(command).toContain('-map 0:a');
    expect(command).toContain('/tmp/out.mp4');
    // default (non-mute) path: no blank-audio prelude
    expect(command).not.toContain('anullsrc');
    expect(logger.info).toHaveBeenCalled();
  });

  it('adds the blank-audio prelude when muteSection is true', () => {
    const { seg } = buildSegment(ProjectVideo, {
      options: { duration: 6, muteSection: true },
    });

    seg.configure();

    expect(seg.getCommand()).toContain('anullsrc');
  });

  it('prefers a section-specific path from userVideoPaths over this.source', () => {
    const { seg, logger } = buildSegment(ProjectVideo, {
      sectionName: 'hero',
      options: { duration: 3 },
      source: '/videos/default.mp4',
      projectConfig: {
        hardwareConfig: { preset: 'fast' },
        userVideoPaths: { hero: '/videos/hero-specific.mp4' },
      },
    });

    seg.configure();
    const command = seg.getCommand();

    expect(command).toContain('-i /videos/hero-specific.mp4');
    expect(command).not.toContain('-i /videos/default.mp4');
    expect(command).toContain('-preset fast');
    // logs the available userVideoPaths keys
    expect(logger.info).toHaveBeenCalledWith('[ProjectVideo] Available userVideoPaths:', {
      paths: ['hero'],
    });
  });

  it('keeps this.source when userVideoPaths has no entry for the section name', () => {
    const { seg } = buildSegment(ProjectVideo, {
      sectionName: 'missing',
      options: { duration: 3 },
      source: '/videos/default.mp4',
      projectConfig: {
        hardwareConfig: { preset: 'medium' },
        userVideoPaths: { other: '/videos/other.mp4' },
      },
    });

    seg.configure();

    expect(seg.getCommand()).toContain('-i /videos/default.mp4');
  });

  it('omits the -t duration flag when duration is zero or missing', () => {
    const { seg } = buildSegment(ProjectVideo, {
      options: {},
      source: '/videos/clip.mp4',
    });

    seg.configure();

    expect(seg.getCommand()).not.toContain('-t ');
  });
});

describe('ImageBackgroundSegment.configure', () => {
  it('builds a looped image command with blank audio and the given sources', () => {
    const { seg } = buildSegment(ImageBackground, {
      options: { duration: 7 },
      sources: ['-i /tmp/bg.png'],
    });

    seg.configure();
    const command = seg.getCommand();

    expect(command).toContain('-loop 1');
    expect(command).toContain('-i /tmp/bg.png');
    expect(command).toContain('-t 7');
    expect(command).toContain('anullsrc');
    expect(command).toContain('-map 0:a');
    expect(command).toContain('/tmp/out.mp4');
  });

  it('passes through the hwaccel argument', () => {
    const { seg } = buildSegment(ImageBackground, {
      options: { duration: 7 },
      hwaccelArg: '-hwaccel vaapi',
    });

    seg.configure();

    expect(seg.getCommand()).toContain('-hwaccel vaapi');
  });
});

describe('ColorBackgroundSegment.configure', () => {
  it('builds a color background command with blank audio and the given sources', () => {
    const { seg } = buildSegment(ColorBackground, {
      options: { duration: 2 },
      sources: ['-f lavfi -i color=c=red:s=1280x720:d=2'],
    });

    seg.configure();
    const command = seg.getCommand();

    expect(command).toContain('color=c=red');
    expect(command).toContain('-t 2');
    expect(command).toContain('anullsrc');
    expect(command).toContain('-map 0:a');
    expect(command).toContain('/tmp/out.mp4');
    // color background does not loop a still image
    expect(command).not.toContain('-loop 1');
  });

  it('passes through the hwaccel argument', () => {
    const { seg } = buildSegment(ColorBackground, {
      options: { duration: 2 },
      hwaccelArg: '-hwaccel qsv',
    });

    seg.configure();

    expect(seg.getCommand()).toContain('-hwaccel qsv');
  });
});

describe('addBlankAudio (inherited)', () => {
  it('encodes the configured channel layout and sample rate', () => {
    const { seg } = buildSegment(Video, {
      projectConfig: {
        audioConfig: { channelLayout: 'mono', sampleRate: 48000 },
        videoConfig: { scale: '1280:720' },
      },
    });

    const blank = seg.addBlankAudio();

    expect(blank).toContain('anullsrc=channel_layout=mono:sample_rate=48000');
    expect(blank).toContain('-f lavfi');
  });

  it('falls back to empty strings when audioConfig is absent', () => {
    const { seg } = buildSegment(Video, {
      projectConfig: { audioConfig: undefined, videoConfig: { scale: '1280:720' } },
    });

    const blank = seg.addBlankAudio();

    expect(blank).toContain('channel_layout=:sample_rate=');
  });
});
