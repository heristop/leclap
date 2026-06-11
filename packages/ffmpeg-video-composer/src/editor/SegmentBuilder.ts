import { injectable, inject, container } from 'tsyringe';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type { MapAnimationInput, Section, SectionOptions } from '@/core/types';
import type Template from '../core/models/Template';
import type Project from '../core/models/Project';
import type Segment from '../core/models/Segment';
import type AssetManager from '../editor/managers/AssetManager';
import type VariableManager from '../editor/managers/VariableManager';
import type MapManager from '../editor/managers/MapManager';
import type FilterManager from '../editor/managers/FilterManager';
import type FormattersManager from '../editor/managers/FormatterManager';

// Bag of all service-layer dependencies injected into SegmentBuilder.
// A single token keeps the constructor within the max-params budget (5).
type SegmentManagersBag = {
  assetManager: AssetManager;
  variableManager: VariableManager;
  mapManager: MapManager;
  filterManager: FilterManager;
  formattersManager: FormattersManager;
  logger: AbstractLogger;
  filesystemAdapter: AbstractFilesystem;
};

// Lazy factory: resolved tokens are available by the time SegmentBuilder
// is first resolved from the container, so there is no ordering problem.
container.register<SegmentManagersBag>('SegmentManagersBag', {
  useFactory: (c) => ({
    assetManager: c.resolve<AssetManager>('AssetManager'),
    variableManager: c.resolve<VariableManager>('VariableManager'),
    mapManager: c.resolve<MapManager>('MapManager'),
    filterManager: c.resolve<FilterManager>('FilterManager'),
    formattersManager: c.resolve<FormattersManager>('FormattersManager'),
    logger: c.resolve<AbstractLogger>('logger'),
    filesystemAdapter: c.resolve<AbstractFilesystem>('filesystemAdapter'),
  }),
});

// Runtime-typed view of template.assets.inputs used as a string-keyed cache.
type InputsCache = Record<string, string | string[]>;

// Runtime-typed view of segment.inputsAsset used as a string-keyed store.
type InputsAssetMap = Record<string, string>;

@injectable()
class SegmentBuilder {
  protected command = '-version';

  protected filters = ''; // FFmpeg filters
  protected sources: string[] = []; // FFmpeg inputs

  protected source = '';
  public destination = '';
  protected hwaccelArg = '';

  protected section!: Section;

  /** The video encoder name for this platform — `codecConfig.videoCodec` (h264_mediacodec on device) or `h264`. */
  protected videoCodec(): string {
    // The default ProjectConfig sets videoCodec to '' (empty), so any falsy value must fall back to h264.
    const configured = this.project.config.codecConfig?.videoCodec;

    if (configured) {
      return configured;
    }

    return 'h264';
  }

  /** True when the selected encoder is a hardware one (h264_mediacodec / h264_videotoolbox). */
  protected isHardwareCodec(): boolean {
    const codec = this.videoCodec();

    return codec.includes('mediacodec') || codec.includes('videotoolbox');
  }

  /** `-pix_fmt yuv420p` for software encoders; empty for hardware (the filtergraph sets the format). */
  protected pixFmtArg(): string {
    return this.isHardwareCodec() ? '' : '-pix_fmt yuv420p';
  }

  /**
   * Full `-c:v …` args for re-encoded clips. Defaults to the software (libx264-style) settings used
   * by the server/web. When a hardware encoder (h264_mediacodec / h264_videotoolbox on device) is
   * selected, the libx264-only flags (crf/tune/profile/preset) are dropped — those encoders reject
   * them — in favour of a bitrate target. (Color/image segments use the bare `-c:v ${videoCodec()}`.)
   */
  protected videoEncoderArgs(): string {
    const codec = this.videoCodec();

    if (this.isHardwareCodec()) {
      return `-c:v ${codec} -b:v 8M`;
    }

    // mpeg4 (the on-device LGPL software encoder) takes quality/bitrate, not the libx264-only flags.
    if (codec === 'mpeg4') {
      return '-c:v mpeg4 -q:v 4';
    }

    // libopenh264 (Cisco's LGPL-OK software H.264, used on-device) — bitrate-based; no libx264 flags.
    if (codec === 'libopenh264') {
      return '-c:v libopenh264 -b:v 4M -profile:v main';
    }

    return `-c:v ${codec} -crf 23 -tune film -b:v 12M -profile:v high -preset ${this.project.config.hardwareConfig?.preset ?? 'medium'}`;
  }

  // Unwrapped references kept as protected fields so subclasses can access them.
  protected readonly assetManager: AssetManager;
  protected readonly variableManager: VariableManager;
  protected readonly mapManager: MapManager;
  protected readonly filterManager: FilterManager;
  protected readonly formattersManager: FormattersManager;
  protected readonly logger: AbstractLogger;
  protected readonly filesystemAdapter: AbstractFilesystem;

  constructor(
    @inject('project') protected project: Project,
    @inject('template') protected template: Template,
    @inject('segment') protected segment: Segment,
    @inject('SegmentManagersBag') managers: SegmentManagersBag
  ) {
    this.assetManager = managers.assetManager;
    this.variableManager = managers.variableManager;
    this.mapManager = managers.mapManager;
    this.filterManager = managers.filterManager;
    this.formattersManager = managers.formattersManager;
    this.logger = managers.logger;
    this.filesystemAdapter = managers.filesystemAdapter;

    if (this.template.descriptor.global?.orientation === 'portrait') {
      const parts = this.project.config.videoConfig?.scale?.split(':');
      const width = parts?.[0];
      const height = parts?.[1];

      if (width !== undefined && height !== undefined && this.project.config.videoConfig) {
        // Clone rather than mutate in place: `project.config.videoConfig` is the caller's shared
        // ProjectConfig object, so an in-place swap leaks the portrait scale into later compiles that
        // reuse the same config (e.g. a portrait job then a landscape one → landscape comes out vertical).
        this.project.config.videoConfig = { ...this.project.config.videoConfig, scale: `${height}:${width}` };
      }
    }
  }

  hydrate = (section: Section): SegmentBuilder => {
    this.section = section;
    this.section.inputs ??= [];

    this.segment.currentSection = this.section;

    // Reset segment state for new section
    this.segment.filtersList = [];
    this.segment.filtersMapList = [];
    this.segment.mapsList = [];
    this.segment.tempFonts = [];
    this.segment.inputsAsset = [];
    this.segment.inputsMapCount = 0;

    this.assetManager.segment = this.segment;
    this.mapManager.segment = this.segment;
    this.filterManager.segment = this.segment;
    this.formattersManager.segment = this.segment;

    this.filesystemAdapter.setSegment(this.section.name);

    return this;
  };

  init = async (): Promise<boolean> => {
    this.source = this.filesystemAdapter.getSource();
    this.destination = this.filesystemAdapter.getDestination();

    this.logger.info(`[${this.section.name}][Source] ${this.source}`);
    this.logger.info(`[${this.section.name}][Dest] ${this.destination}`);

    await this.assetManager.setUpPaths();
    this.normalizeBackgroundColor();

    const built = await this.buildSegment();

    if (!built) {
      return false;
    }

    this.applyHwaccel();
    this.configure();
    this.logger.info(`[${this.section.name}][Config] finalized`);

    return true;
  };

  private readonly normalizeBackgroundColor = (): void => {
    const opts = this.section.options;

    if (opts?.backgroundColor) {
      opts.backgroundColor = this.formattersManager.formatColor(opts.backgroundColor);
    }
  };

  private readonly buildSegment = async (): Promise<boolean> => {
    try {
      await this.assetManager.fetchAssets();
      this.logger.info(`[${this.section.name}][Assets] fetched`);

      await this.buildMaps();
      this.logger.info(`[${this.section.name}][Maps] built`);

      await this.buildFilters();
      this.logger.info(`[${this.section.name}][Filters] built`);

      this.buildInputs();
      this.logger.info(`[${this.section.name}][Inputs] built`);

      await this.assetManager.fetchFonts();
      this.logger.info(`[${this.section.name}][Fonts] fetched`);

      return true;
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));

      return false;
    }
  };

  private readonly applyHwaccel = (): void => {
    const hwaccel = this.project.config.hardwareConfig?.hwaccel;

    // Truthy check covers both null and undefined without loose equality (eqeqeq)
    if (hwaccel) {
      this.hwaccelArg = `-hwaccel ${hwaccel}`;
    }
  };

  protected configure = (): void => {};

  getCommand = () => this.command;

  getProject() {
    return this.project;
  }

  buildInputs = (): void => {
    const opts = this.section.options;
    const inputsAsset = this.segment.inputsAsset as unknown as InputsAssetMap;
    const hasAssets = Object.keys(inputsAsset).length > 0;

    if (opts?.backgroundColor) {
      const bgColor = hasAssets ? opts.backgroundColor : 'white@0.0';
      const scale = this.project.config.videoConfig?.scale?.replace(':', 'x') ?? '';
      const duration = opts.duration ?? '';

      // Manage background color input
      this.sources.push(`-f lavfi -i color=c=${bgColor}:s=${scale}:d=${duration}`);
    }

    for (const value of Object.values(inputsAsset)) {
      this.sources.push(`-i ${value}`);
    }
  };

  buildMaps = async (): Promise<void> => {
    this.segment.inputsAsset = [];

    const inputsAsset = this.segment.inputsAsset as unknown as InputsAssetMap;
    const inputsCache = this.template.assets.inputs as unknown as InputsCache;

    for (const input of this.section.inputs ?? []) {
      if (
        (input as MapAnimationInput).type === 'frame' &&
        input.url !== undefined &&
        new RegExp('(.*?).(zip)$').test(input.url) &&
        inputsCache[input.name]
      ) {
        this.processZipFrames(input as MapAnimationInput, inputsCache, inputsAsset);
        continue;
      }

      const mapInput = input as MapAnimationInput;

      if (mapInput.type === 'frame' && mapInput.options.frames) {
        this.processCachedFrames(mapInput, input.name, inputsAsset);
        continue;
      }

      // Process single media
      inputsAsset[`asset_${input.name}`] = this.assetManager.fetchCachedMedia(input);
    }
  };

  private readonly processZipFrames = (
    mapInput: MapAnimationInput,
    inputsCache: InputsCache,
    inputsAsset: InputsAssetMap
  ): void => {
    const frames = inputsCache[mapInput.name];
    const framesArray = Array.isArray(frames) ? frames : [frames];

    if (!mapInput.options.frames) {
      mapInput.options.frames = framesArray.length;
    }

    for (let i = 1; i <= framesArray.length; i++) {
      inputsAsset[`asset_${mapInput.name}_${i}`] = framesArray[i - 1] ?? '';
      this.mapManager.addMapAnimation(mapInput, i);
    }
  };

  private readonly processCachedFrames = (
    mapInput: MapAnimationInput,
    inputName: string,
    inputsAsset: InputsAssetMap
  ): void => {
    for (let i = 1; i <= mapInput.options.frames; i++) {
      inputsAsset[`asset_${inputName}_${i}`] = this.assetManager.fetchCachedMedia(mapInput, i);
      this.mapManager.addMapAnimation(mapInput, i);
    }
  };

  buildFilters = async (): Promise<void> => {
    // Initialize filters if not set
    this.section.maps ??= [];
    this.section.filters ??= [];

    const opts = this.section.options;

    // Force ratio
    if (opts?.forceAspectRatio !== false || opts.forceOriginalAspectRatio) {
      this.prependScaleFilters(opts);
    }

    // Build simple filters
    for (const filter of this.section.filters) {
      this.segment.filtersList.push(this.filterManager.addFilter(filter));
    }

    // Build map configuration with their filters
    for (const map of this.section.maps) {
      this.mapManager.addMap(map);
      this.segment.inputsMapCount++;
    }

    this.formatFilters();
  };

  private readonly prependScaleFilters = (opts: SectionOptions | undefined): void => {
    const baseScale = this.project.config.videoConfig?.scale ?? '';
    let scaleFilter = baseScale;

    if (opts?.forceOriginalAspectRatio) {
      scaleFilter = `${baseScale}:force_original_aspect_ratio=decrease,pad=${baseScale}:(ow-iw)/2:(oh-ih)/2`;
    }

    this.section.filters = [
      { type: 'setsar', value: this.project.config.videoConfig?.setsar },
      { type: 'scale', value: scaleFilter },
      ...(this.section.filters ?? []),
    ];
  };

  /**
   * Index of the input that carries the video stream this segment encodes. The `-vf` path (below) must
   * map it explicitly — otherwise the segment's trailing `-map 0:a?` disables ffmpeg's automatic stream
   * selection and the filtered video is dropped (audio-only output). Default input 0; segments that
   * prepend a blank-audio input (color/image backgrounds, muted clips) override to shift it.
   */
  protected videoInputIndex(): number {
    return 0;
  }

  private readonly formatFilters = (): void => {
    if (this.segment.filtersList.length === 0) {
      return;
    }

    if (this.segment.filtersMapList.length > 0) {
      // Multi-pad graph (overlays/animations) → complex filtergraph; its video output is mapped via the
      // final `[pad]` below, so no `-map N:v` is needed here.
      this.filters = ` -filter_complex "${this.segment.filtersMapList.join(';')}" `;
      this.logger.debug(`[${this.section.name}][Filters] ${this.segment.filtersMapList.join(';')}`);
    }

    if (this.segment.filtersMapList.length === 0) {
      // Single linear chain (scale/pad/drawtext/…) → use `-vf`, not `-filter_complex`. They are
      // equivalent here, but the on-device embedded engine can't resolve `drawtext` inside a
      // `-filter_complex` graph ("No such filter: drawtext"), while `-vf` works. The explicit
      // `-map N:v` keeps the filtered video in the output despite the trailing `-map 0:a?`.
      this.filters = ` -vf "${this.segment.filtersList.join(',')}" -map ${this.videoInputIndex()}:v `;
      this.logger.debug(`[${this.section.name}][Filters] ${this.segment.filtersList.join(',')}`);
    }

    // Add final map if present (complex-graph video output pad).
    if (this.segment.mapsList.length > 0) {
      this.filters = `${this.filters} -map [${this.segment.mapsList.at(-1)}] `;
      this.logger.debug(`[${this.section.name}][Maps] ${this.segment.mapsList.join(' ')}`);
    }
  };

  /**
   * Generate blank audio track for concatenation
   */
  addBlankAudio = (): string => {
    const channelLayout = this.project.config.audioConfig?.channelLayout ?? '';
    const sampleRate = this.project.config.audioConfig?.sampleRate ?? '';

    return ' -f lavfi -i anullsrc=channel_layout=' + channelLayout + ':sample_rate=' + sampleRate + ' ';
  };
}

export default SegmentBuilder;
