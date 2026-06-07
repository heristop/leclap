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
        this.project.config.videoConfig.scale = `${height}:${width}`;
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

  private readonly formatFilters = (): void => {
    // Format filters
    if (this.segment.filtersList.length > 0) {
      // Complex filter with maps when available, otherwise without maps
      const filtersFormatted =
        this.segment.filtersMapList.length > 0
          ? this.segment.filtersMapList.join(';')
          : this.segment.filtersList.join(',');

      this.filters = ` -filter_complex "${filtersFormatted}" `;
      this.logger.debug(`[${this.section.name}][Filters] ${filtersFormatted}`);
    }

    // Add final map if present
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

    return (
      ' -f lavfi ' +
      ' -i anullsrc=channel_layout=' +
      channelLayout +
      ':sample_rate=' +
      sampleRate +
      ' '
    );
  };
}

export default SegmentBuilder;
