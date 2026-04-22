import { injectable, inject } from 'tsyringe';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type { MapAnimationInput, Section } from '@/core/types';
import type Template from '../core/models/Template';
import type Project from '../core/models/Project';
import type Segment from '../core/models/Segment';
import type AssetManager from '../editor/managers/AssetManager';
import type VariableManager from '../editor/managers/VariableManager';
import type MapManager from '../editor/managers/MapManager';
import type FilterManager from '../editor/managers/FilterManager';
import type FormattersManager from '../editor/managers/FormatterManager';

@injectable()
class SegmentBuilder {
  protected command = '-version';

  protected filters = ''; // FFmpeg filters
  protected sources: string[] = []; // FFmpeg inputs

  protected source = '';
  public destination = '';
  protected hwaccelArg = '';

  protected section!: Section;

  constructor(
    @inject('project') protected project: Project,
    @inject('template') protected template: Template,
    @inject('segment') protected segment: Segment,

    @inject('AssetManager') protected assetManager: AssetManager,
    @inject('VariableManager') protected variableManager: VariableManager,
    @inject('MapManager') protected mapManager: MapManager,
    @inject('FilterManager') protected filterManager: FilterManager,
    @inject('FormattersManager') protected formattersManager: FormattersManager,

    @inject('logger') protected readonly logger: AbstractLogger,
    @inject('filesystemAdapter')
    protected readonly filesystemAdapter: AbstractFilesystem
  ) {
    if (this.template.descriptor?.global?.orientation === 'portrait') {
      const [width, height] = this.project.config.videoConfig.scale.split(':');
      this.project.config.videoConfig.scale = `${height}:${width}`;
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

    // Format background color if option is set
    if (this.section.options.backgroundColor) {
      this.section.options.backgroundColor = this.formattersManager.formatColor(this.section.options.backgroundColor);
    }

    try {
      // Fetch remote or cached assets
      await this.assetManager.fetchAssets();
      this.logger.info(`[${this.section.name}][Assets] fetched`);

      // Build FFmpeg maps
      await this.buildMaps();
      this.logger.info(`[${this.section.name}][Maps] built`);

      // Build FFmpeg filters
      await this.buildFilters();
      this.logger.info(`[${this.section.name}][Filters] built`);

      // Build FFmpeg inputs
      this.buildInputs();
      this.logger.info(`[${this.section.name}][Inputs] built`);

      // Fetch remote or cached fonts
      await this.assetManager.fetchFonts();
      this.logger.info(`[${this.section.name}][Fonts] fetched`);
    } catch (error) {
      this.logger.error(error);

      return false;
    }

    // Configure Hardware Acceleration
    if (null !== this.project.config.hardwareConfig.hwaccel) {
      this.hwaccelArg = `-hwaccel ${this.project.config.hardwareConfig.hwaccel}`;
    }

    // Configure FFmpeg command
    this.configure();

    this.logger.info(`[${this.section.name}][Config] finalized`);

    return true;
  };

  protected configure = (): void => { };

  getCommand = () => this.command;

  getProject() {
    return this.project;
  }

  buildInputs = (): void => {
    let { backgroundColor } = this.section.options;

    if (this.section.options.backgroundColor) {
      if (!this.segment.inputsAsset) {
        backgroundColor = 'white@0.0';
      }

      // Manage background color input
      this.sources.push(
        `-f lavfi -i color=c=${backgroundColor}:s=${this.project.config.videoConfig.scale.replace(':', 'x')}:d=${this.section.options.duration}`
      );
    }

    if (this.segment.inputsAsset) {
      for (const property in this.segment.inputsAsset) {
        if (property in this.segment.inputsAsset) {
          this.sources.push(`-i ${this.segment.inputsAsset[property]}`);
        }
      }
    }
  };

  buildMaps = async (): Promise<void> => {
    this.segment.inputsAsset = [];

    for (const input of this.section.inputs) {
      if (
        (input as MapAnimationInput).type === 'frame' &&
        new RegExp('(.*?).(zip)$').test(input.url) &&
        this.template.assets.inputs[input.name]
      ) {
        // Retrieve unzipped frames
        const mapAnimationInput = input as MapAnimationInput;
        const frames = this.template.assets.inputs[input.name];
        if (!mapAnimationInput.options.frames) {
          mapAnimationInput.options.frames = frames.length;
        }
        for (let i = 1; i <= frames.length; i++) {
          this.segment.inputsAsset[`asset_${input.name}_${i}`] = frames[i - 1];
          this.mapManager.addMapAnimation(mapAnimationInput, i);
        }
      } else if (
        (input as MapAnimationInput).type === 'frame' &&
        (input as MapAnimationInput).options &&
        (input as MapAnimationInput).options.frames
      ) {
        // Retrieve cached frames
        const mapAnimationInput = input as MapAnimationInput;
        for (let i = 1; i <= mapAnimationInput.options.frames; i++) {
          this.segment.inputsAsset[`asset_${input}`] = this.assetManager.fetchCachedMedia(input, i);
          this.mapManager.addMapAnimation(mapAnimationInput, i);
        }
      } else {
        // Process single media
        this.segment.inputsAsset[`asset_${input}`] = this.assetManager.fetchCachedMedia(input);
      }
    }
  };

  buildFilters = async (): Promise<void> => {
    // Initialize filters if not set
    this.section.maps ??= [];
    this.section.filters ??= [];

    // Force ratio
    if (this.section.options.forceAspectRatio !== false || this.section.options.forceOriginalAspectRatio) {
      let scaleFilter = this.project.config.videoConfig.scale;

      if (this.section.options.forceOriginalAspectRatio) {
        scaleFilter = `${this.project.config.videoConfig.scale}:force_original_aspect_ratio=decrease,pad=${this.project.config.videoConfig.scale}:(ow-iw)/2:(oh-ih)/2`;
      }

      this.section.filters = [
        { type: 'setsar', value: this.project.config.videoConfig.setsar },
        { type: 'scale', value: scaleFilter },
        ...this.section.filters,
      ];
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

    // Format filters
    if (this.segment.filtersList.length > 0) {
      let filtersFormatted = '';

      if (this.segment.filtersMapList.length > 0) {
        // Complex filter with maps
        filtersFormatted = this.segment.filtersMapList.join(';');
      } else {
        // Complex filter without maps
        filtersFormatted = this.segment.filtersList.join(',');
      }

      this.filters = ` -filter_complex "${filtersFormatted}" `;
      this.logger.debug(`[${this.section.name}][Filters] ${filtersFormatted}`);
    }

    // Add final map if present
    if (this.segment.mapsList.length > 0) {
      this.filters = `${this.filters} -map [${this.segment.mapsList[this.segment.mapsList.length - 1]}] `;
      this.logger.debug(`[${this.section.name}][Maps] ${this.segment.mapsList.join(' ')}`);
    }
  };

  /**
   * Generate blank audio track for concatenation
   */
  addBlankAudio = (): string => {
    return (
      ' -f lavfi ' +
      ' -i anullsrc=channel_layout=' +
      this.project.config.audioConfig.channelLayout +
      ':sample_rate=' +
      this.project.config.audioConfig.sampleRate +
      ' '
    );
  };
}

export default SegmentBuilder;
