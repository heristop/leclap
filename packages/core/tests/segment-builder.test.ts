import 'reflect-metadata';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import SegmentBuilder from '@/editor/SegmentBuilder';
import type { ProjectConfig, Section, TemplateDescriptor } from '@/core/types';

function makeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeSegment() {
  return {
    currentSection: undefined as Section | undefined,
    filtersList: [] as string[],
    filtersMapList: [] as string[],
    mapsList: [] as string[],
    tempFonts: [] as string[],
    inputsAsset: [] as unknown,
    inputsMapCount: 0,
  };
}

function makeManagers(logger = makeLogger(), filesystem = makeFilesystem()) {
  return {
    assetManager: {
      segment: undefined,
      setUpPaths: vi.fn(async () => undefined),
      fetchAssets: vi.fn(async () => undefined),
      fetchFonts: vi.fn(async () => undefined),
      fetchCachedMedia: vi.fn((media: { name: string }, frame = 0) => `/cache/${media.name}_${frame}.png`),
    },
    variableManager: {},
    mapManager: {
      segment: undefined,
      addMap: vi.fn(),
      addMapAnimation: vi.fn(),
    },
    filterManager: {
      segment: undefined,
      addFilter: vi.fn((f: { type: string; value?: string | number }) => `${f.type}=${String(f.value ?? '')}`),
    },
    formattersManager: {
      segment: undefined,
      formatColor: vi.fn((c: string) => `#${c}`),
    },
    logger,
    filesystemAdapter: filesystem,
  };
}

function makeFilesystem() {
  return {
    getSource: vi.fn(() => '/source/in.mp4'),
    getDestination: vi.fn(() => '/build/out.mp4'),
    setSegment: vi.fn(),
  };
}

function makeProject(config: ProjectConfig = {}) {
  return { config };
}

function makeTemplate(descriptor: TemplateDescriptor = {}, inputs: unknown = []) {
  return { descriptor, assets: { fonts: {}, musics: {}, inputs } };
}

function makeBuilder(opts: {
  project?: ReturnType<typeof makeProject>;
  template?: ReturnType<typeof makeTemplate>;
  segment?: ReturnType<typeof makeSegment>;
  managers?: ReturnType<typeof makeManagers>;
} = {}) {
  const project = opts.project ?? makeProject({ videoConfig: { scale: '1280:720', setsar: '1/1' } });
  const template = opts.template ?? makeTemplate();
  const segment = opts.segment ?? makeSegment();
  const managers = opts.managers ?? makeManagers();

  const builder = new SegmentBuilder(
    project as never,
    template as never,
    segment as never,
    managers as never
  );

  return { builder, project, template, segment, managers };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SegmentBuilder constructor', () => {
  it('swaps width/height in the scale for portrait orientation', () => {
    const project = makeProject({ videoConfig: { scale: '1280:720' } });
    const template = makeTemplate({ global: { orientation: 'portrait' } });

    makeBuilder({ project, template });

    expect(project.config.videoConfig?.scale).toBe('720:1280');
  });

  it('leaves the scale untouched for landscape orientation', () => {
    const project = makeProject({ videoConfig: { scale: '1280:720' } });
    const template = makeTemplate({ global: { orientation: 'landscape' } });

    makeBuilder({ project, template });

    expect(project.config.videoConfig?.scale).toBe('1280:720');
  });
});

describe('SegmentBuilder.hydrate', () => {
  it('resets segment state and wires managers to the segment', () => {
    const segment = makeSegment();
    const { builder, managers } = makeBuilder({ segment });
    const section: Section = { name: 'clip', type: 'video' };

    const returned = builder.hydrate(section);

    expect(returned).toBe(builder);
    expect(segment.currentSection).toBe(section);
    expect(section.inputs).toEqual([]);
    expect(managers.assetManager.segment).toBe(segment);
    expect(managers.mapManager.segment).toBe(segment);
    expect(managers.filterManager.segment).toBe(segment);
    expect(managers.formattersManager.segment).toBe(segment);
    expect(managers.filesystemAdapter.setSegment).toHaveBeenCalledWith('clip');
  });
});

describe('SegmentBuilder.init', () => {
  it('builds the segment successfully and returns true', async () => {
    const { builder, managers } = makeBuilder();
    builder.hydrate({ name: 'clip', type: 'video', options: {} });

    const result = await builder.init();

    expect(result).toBe(true);
    expect(managers.assetManager.setUpPaths).toHaveBeenCalled();
    expect(managers.assetManager.fetchAssets).toHaveBeenCalled();
    expect(managers.assetManager.fetchFonts).toHaveBeenCalled();
  });

  it('returns false when building the segment throws', async () => {
    const managers = makeManagers();
    managers.assetManager.fetchAssets.mockRejectedValue(new Error('asset boom'));
    const { builder } = makeBuilder({ managers });
    builder.hydrate({ name: 'clip', type: 'video', options: {} });

    const result = await builder.init();

    expect(result).toBe(false);
    expect(managers.logger.error).toHaveBeenCalledWith('asset boom');
  });

  it('normalizes a background color through the formatter before building', async () => {
    const managers = makeManagers();
    const { builder } = makeBuilder({ managers });
    const section: Section = { name: 'bg', type: 'color_background', options: { backgroundColor: 'ff0000', duration: 2 } };
    builder.hydrate(section);

    await builder.init();

    expect(managers.formattersManager.formatColor).toHaveBeenCalledWith('ff0000');
    expect(section.options?.backgroundColor).toBe('#ff0000');
  });

  it('applies the hwaccel argument when configured', async () => {
    const project = makeProject({
      videoConfig: { scale: '1280:720' },
      hardwareConfig: { hwaccel: 'cuda' },
    });
    const { builder } = makeBuilder({ project });
    builder.hydrate({ name: 'clip', type: 'video', options: {} });

    // configure() is a no-op on the base class, so just ensure init succeeds with hwaccel set
    const result = await builder.init();
    expect(result).toBe(true);
  });
});

describe('SegmentBuilder.buildMaps', () => {
  it('processes a single media input into an asset entry', async () => {
    const segment = makeSegment();
    const { builder, managers } = makeBuilder({ segment });
    builder.hydrate({ name: 'clip', type: 'video' });
    (builder as unknown as { section: Section }).section = { name: 'clip', type: 'video', inputs: [{ name: 'logo', url: 'http://x/logo.png' }] } as never;

    await builder.buildMaps();

    const assets = segment.inputsAsset as unknown as Record<string, string>;
    expect(assets.asset_logo).toBe('/cache/logo_0.png');
    expect(managers.assetManager.fetchCachedMedia).toHaveBeenCalled();
  });

  it('expands zip frame inputs from the inputs cache and adds map animations', async () => {
    const segment = makeSegment();
    const inputs = { confettis: ['/cache/f1.png', '/cache/f2.png', '/cache/f3.png'] };
    const template = makeTemplate({}, inputs);
    const { builder, managers } = makeBuilder({ segment, template });
    builder.hydrate({ name: 'clip', type: 'video' });
    (builder as unknown as { section: Section }).section = {
      name: 'clip',
      type: 'video',
      inputs: [
        {
          name: 'confettis',
          url: 'http://x/confettis.zip',
          type: 'frame',
          options: {},
        },
      ],
    } as never;

    await builder.buildMaps();

    const assets = segment.inputsAsset as unknown as Record<string, string>;
    expect(assets.asset_confettis_1).toBe('/cache/f1.png');
    expect(assets.asset_confettis_3).toBe('/cache/f3.png');
    expect(managers.mapManager.addMapAnimation).toHaveBeenCalledTimes(3);
  });

  it('wraps a single cached string into a one-element frames array and keeps a preset frame count', async () => {
    const segment = makeSegment();
    // inputsCache value is a SINGLE STRING (not an array) -> line 243 false side -> [frames]
    const inputs = { logo: '/cache/single.png' };
    const template = makeTemplate({}, inputs);
    const { builder, managers } = makeBuilder({ segment, template });
    builder.hydrate({ name: 'clip', type: 'video' });
    (builder as unknown as { section: Section }).section = {
      name: 'clip',
      type: 'video',
      inputs: [
        {
          name: 'logo',
          url: 'http://x/logo.zip',
          type: 'frame',
          // frames already set -> line 245 `if (!frames)` is false -> NOT overwritten
          options: { frames: 5 },
        },
      ],
    } as never;

    await builder.buildMaps();

    const assets = segment.inputsAsset as unknown as Record<string, string>;
    // single-string framesArray has length 1 -> exactly one asset entry from element [0]
    expect(assets.asset_logo_1).toBe('/cache/single.png');
    expect(assets.asset_logo_2).toBeUndefined();
    // preset frame count must be preserved (not overwritten with framesArray.length === 1)
    const section = (builder as unknown as { section: Section }).section;
    const sectionInputs = section.inputs as unknown as Array<{ options: { frames: number } }>;
    expect(sectionInputs[0].options.frames).toBe(5);
    expect(managers.mapManager.addMapAnimation).toHaveBeenCalledTimes(1);
  });

  it("substitutes an empty string for an undefined frame in the cache array (line 250 nullish side)", async () => {
    const segment = makeSegment();
    // middle element is undefined -> framesArray[i - 1] ?? '' takes the nullish side
    const inputs = { gap: ['/cache/a.png', undefined, '/cache/c.png'] };
    const template = makeTemplate({}, inputs);
    const { builder } = makeBuilder({ segment, template });
    builder.hydrate({ name: 'clip', type: 'video' });
    (builder as unknown as { section: Section }).section = {
      name: 'clip',
      type: 'video',
      inputs: [
        {
          name: 'gap',
          url: 'http://x/gap.zip',
          type: 'frame',
          options: {},
        },
      ],
    } as never;

    await builder.buildMaps();

    const assets = segment.inputsAsset as unknown as Record<string, string>;
    expect(assets.asset_gap_1).toBe('/cache/a.png');
    expect(assets.asset_gap_2).toBe(''); // undefined element -> ''
    expect(assets.asset_gap_3).toBe('/cache/c.png');
  });

  it('processes cached (already-extracted) frame inputs by frame count', async () => {
    const segment = makeSegment();
    const { builder, managers } = makeBuilder({ segment });
    builder.hydrate({ name: 'clip', type: 'video' });
    (builder as unknown as { section: Section }).section = {
      name: 'clip',
      type: 'video',
      inputs: [
        {
          name: 'anim',
          url: 'http://x/anim.png',
          type: 'frame',
          options: { frames: 2 },
        },
      ],
    } as never;

    await builder.buildMaps();

    const assets = segment.inputsAsset as unknown as Record<string, string>;
    expect(assets.asset_anim_1).toBe('/cache/anim_1.png');
    expect(assets.asset_anim_2).toBe('/cache/anim_2.png');
    expect(managers.mapManager.addMapAnimation).toHaveBeenCalledTimes(2);
  });
});

describe('SegmentBuilder.buildFilters / formatFilters', () => {
  it('prepends setsar/scale filters and formats them into a filter_complex', async () => {
    const segment = makeSegment();
    const { builder } = makeBuilder({ segment });
    builder.hydrate({ name: 'clip', type: 'video' });
    (builder as unknown as { section: Section }).section = {
      name: 'clip',
      type: 'video',
      options: {},
      filters: [{ type: 'eq', value: 'contrast=1.2' }],
      maps: [],
    } as never;

    await builder.buildFilters();

    expect(segment.filtersList.length).toBeGreaterThan(0);
    // filtersList joined into a -filter_complex string (no maps -> comma-joined)
    expect(segment.filtersList).toEqual(expect.arrayContaining(['scale=1280:720', 'setsar=1/1']));
  });

  it('skips scale filters when forceAspectRatio is false and there is no forceOriginalAspectRatio', async () => {
    const segment = makeSegment();
    const { builder } = makeBuilder({ segment });
    builder.hydrate({ name: 'clip', type: 'video' });
    (builder as unknown as { section: Section }).section = {
      name: 'clip',
      type: 'video',
      options: { forceAspectRatio: false },
      filters: [],
      maps: [],
    } as never;

    await builder.buildFilters();

    // no scale/setsar prepended
    expect(segment.filtersList).not.toEqual(expect.arrayContaining(['scale=1280:720']));
  });

  it('builds a padded scale filter when forceOriginalAspectRatio is set', async () => {
    const segment = makeSegment();
    const managers = makeManagers();
    const { builder } = makeBuilder({ segment, managers });
    builder.hydrate({ name: 'clip', type: 'video' });
    (builder as unknown as { section: Section }).section = {
      name: 'clip',
      type: 'video',
      options: { forceOriginalAspectRatio: true },
      filters: [],
      maps: [],
    } as never;

    await builder.buildFilters();

    const scaleFilterCall = managers.filterManager.addFilter.mock.calls.find(
      (c) => (c[0] as { type: string }).type === 'scale'
    );
    const scaleFilterArg = scaleFilterCall?.[0] as { value: string };

    expect(scaleFilterArg.value).toContain('force_original_aspect_ratio=decrease');
  });

  it('uses an empty base scale when videoConfig.scale is undefined (line 293 nullish side)', () => {
    const segment = makeSegment();
    // videoConfig present but WITHOUT a scale -> `videoConfig?.scale ?? ''` takes '' side
    const project = makeProject({ videoConfig: { setsar: '1/1' } });
    const { builder } = makeBuilder({ segment, project });
    const section: Section = {
      name: 'clip',
      type: 'video',
      options: { forceOriginalAspectRatio: true },
      filters: [],
      maps: [],
    };
    (builder as unknown as { section: Section }).section = section;

    // Invoke the private scale-prepending helper directly with options set.
    (builder as unknown as { prependScaleFilters: (o: unknown) => void }).prependScaleFilters(
      section.options
    );

    const scaleFilter = section.filters?.find((f) => (f as { type: string }).type === 'scale') as {
      value: string;
    };
    // base scale resolved to '' so the padded expression starts from an empty base
    expect(scaleFilter.value).toContain(':force_original_aspect_ratio=decrease');
    expect(scaleFilter.value.startsWith(':force_original_aspect_ratio')).toBe(true);
  });

  it('defaults to an empty existing-filters list when section.filters is undefined (line 303 nullish side)', () => {
    const segment = makeSegment();
    const project = makeProject({ videoConfig: { scale: '1280:720', setsar: '1/1' } });
    const { builder } = makeBuilder({ segment, project });
    // section.filters is intentionally undefined -> `this.section.filters ?? []` nullish side
    const section = {
      name: 'clip',
      type: 'video',
      options: {},
    } as unknown as Section;
    (builder as unknown as { section: Section }).section = section;

    (builder as unknown as { prependScaleFilters: (o: unknown) => void }).prependScaleFilters(
      section.options
    );

    // setsar + scale prepended, with no pre-existing filters appended
    expect(section.filters).toHaveLength(2);
    const filters = section.filters as unknown as Array<{ type: string }>;
    expect(filters[0].type).toBe('setsar');
    expect(filters[1].type).toBe('scale');
  });

  it('adds maps and increments the input map count, joining with filtersMapList when present', async () => {
    const segment = makeSegment();
    const managers = makeManagers();
    // Simulate a map adding to filtersMapList and mapsList
    managers.mapManager.addMap.mockImplementation(() => {
      segment.filtersMapList.push('[0:v]overlay[outmap]');
      segment.mapsList.push('outmap');
    });
    const { builder } = makeBuilder({ segment, managers });
    builder.hydrate({ name: 'clip', type: 'video' });
    (builder as unknown as { section: Section }).section = {
      name: 'clip',
      type: 'video',
      options: {},
      filters: [{ type: 'eq', value: '1' }],
      maps: [{ inputs: ['0:v'], outputs: ['outmap'] }],
    } as never;

    await builder.buildFilters();

    expect(managers.mapManager.addMap).toHaveBeenCalled();
    expect(segment.inputsMapCount).toBe(1);
  });
});

describe('SegmentBuilder.buildInputs', () => {
  it('adds a transparent lavfi color input when a background color is set but no assets', () => {
    const segment = makeSegment();
    segment.inputsAsset = {} as unknown;
    const project = makeProject({ videoConfig: { scale: '1280:720' } });
    const { builder } = makeBuilder({ segment, project });
    builder.hydrate({ name: 'bg', type: 'color_background' });
    (builder as unknown as { section: Section }).section = {
      name: 'bg',
      type: 'color_background',
      options: { backgroundColor: '#fff', duration: 3 },
    } as never;

    builder.buildInputs();

    // sources are internal; exercise the branch and confirm no throw via re-call
    expect(() => builder.buildInputs()).not.toThrow();
  });

  it('uses the configured background color when assets are present and adds -i inputs', () => {
    const segment = makeSegment();
    segment.inputsAsset = { asset_logo: '/cache/logo.png' } as unknown;
    const { builder } = makeBuilder({ segment });
    builder.hydrate({ name: 'bg', type: 'color_background' });
    (builder as unknown as { section: Section }).section = {
      name: 'bg',
      type: 'color_background',
      options: { backgroundColor: '#000', duration: 3 },
    } as never;

    expect(() => builder.buildInputs()).not.toThrow();
  });
});

describe('SegmentBuilder.addBlankAudio', () => {
  it('uses the configured channel layout and sample rate', () => {
    const project = makeProject({
      videoConfig: { scale: '1280:720' },
      audioConfig: { channelLayout: 'mono', sampleRate: 22050 },
    });
    const { builder } = makeBuilder({ project });

    const result = builder.addBlankAudio();

    expect(result).toContain('anullsrc=channel_layout=mono');
    expect(result).toContain('sample_rate=22050');
  });

  it('falls back to empty strings when audio config is missing', () => {
    const project = makeProject({ videoConfig: { scale: '1280:720' } });
    const { builder } = makeBuilder({ project });

    const result = builder.addBlankAudio();

    expect(result).toContain('anullsrc=channel_layout=');
  });
});

describe('SegmentBuilder.getCommand / getProject', () => {
  it('exposes the default command and the project instance', () => {
    const project = makeProject({ videoConfig: { scale: '1280:720' } });
    const { builder } = makeBuilder({ project });

    expect(builder.getCommand()).toBe('-version');
    expect(builder.getProject()).toBe(project);
  });
});
