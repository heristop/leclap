import { autoInjectable, inject } from 'tsyringe';
import AbstractLogger from '../platform/logging/AbstractLogger';
import AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import { MapAnimationInput, Section } from '@/core/types';
import Template from '../core/models/Template';
import Project from '../core/models/Project';
import Segment from '../core/models/Segment';
import AssetManager from '../editor/managers/AssetManager';
import VariableManager from '../editor/managers/VariableManager';
import MapManager from '../editor/managers/MapManager';
import FilterManager from '../editor/managers/FilterManager';
import FormattersManager from '../editor/managers/FormatterManager';

@autoInjectable()
class SegmentBuilder {
  protected command: string = '-version';

  protected filters: string = ''; // FFmpeg filters
  protected sources: string[] = []; // FFmpeg inputs

  protected source: string = '';
  protected destination: string = '';
  protected hwaccelArg: string = '';

  protected section: Section;

  constructor(
    protected project: Project,
    protected template: Template,
    protected segment: Segment,

    protected assetManager: AssetManager,
    protected variableManager: VariableManager,
    protected mapManager: MapManager,
    protected filterManager: FilterManager,
    protected formattersManager: FormattersManager,

    @inject('logger') private readonly logger: AbstractLogger,
    @inject('filesystemAdapter')
    protected readonly filesystemAdapter: AbstractFilesystem
  ) {
    if (this.template.descriptor.global.orientation === 'portrait') {
      const [width, height] = this.project.config.videoConfig.scale.split(':');
      this.project.config.videoConfig.scale = `${height}:${width}`;
    }
  }

  hydrate = (section: Section): SegmentBuilder => {
    this.section = section;
    this.section.inputs ??= [];

    this.segment.currentSection = this.section;

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

  protected configure = (): void => {};

  getCommand = () => this.command;

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
    // Initalized filters if section doesn't have config
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
    this.section.filters.forEach((filter) => {
      this.segment.filtersList.push(this.filterManager.addFilter(filter));
    });

    // Build map configuration with their filters
    this.section.maps.forEach((map) => {
      this.mapManager.addMap(map);
      this.segment.inputsMapCount++;
    });

    // Formatted filters
    if (this.segment.filtersList.length > 0) {
      let filtersFormatted = '';

      if (this.segment.filtersMapList.length > 0) {
        // Manage complex filter with maps
        filtersFormatted = this.segment.filtersMapList.join(';');
      } else {
        // Manage complex filter without maps
        filtersFormatted = this.segment.filtersList.join(',');
      }

      this.filters = ` -filter_complex "${filtersFormatted}" `;
      this.logger.debug(`[${this.section.name}][Filters] ${filtersFormatted}`);
    }

    // And finally add the final map if any
    if (this.segment.mapsList.length > 0) {
      this.filters = `${this.filters} -map [${this.segment.mapsList[this.segment.mapsList.length - 1]}] `;
      this.logger.debug(`[${this.section.name}][Maps] ${this.segment.mapsList.join(' ')}`);
    }
  };

  /**
   * Add blank audio to avoid silent map on cancatenation
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
