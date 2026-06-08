import { inject, injectable } from 'tsyringe';
import type Template from '../../core/models/Template';
import type Segment from '../../core/models/Segment';
import type { Section, Map, MapAnimationInput } from '@/core/types';
import type FormattersManager from './FormatterManager';
import type FilterManager from './FilterManager';

// The shared TemplateAssets type declares `inputs` as string[] for legacy reasons,
// but it is used at runtime as a string-keyed cache of string or string[] values.
type InputsCache = Record<string, string | string[]>;

// Array.prototype.at is available at runtime but not in ES2020 lib types.
// This interface bridges the gap so the linter's prefer-at rule is satisfiable.
interface ArrayWithAt<T> extends Array<T> {
  at(index: number): T | undefined;
}

// Section.inputs is typed as Input[] for schema purposes, but at runtime it holds
// MapAnimationInput objects indexed by string keys (used as a keyed record).
type SectionInputsCache = Record<string, MapAnimationInput>;

@injectable()
class MapManager {
  constructor(
    @inject('template') private readonly template: Template,
    @inject('FormattersManager') protected formattersManager: FormattersManager,
    @inject('FilterManager') protected filterManager: FilterManager,
    @inject('segment') public segment: Segment
  ) {}

  private get currentSection(): Section {
    if (!this.segment.currentSection) {
      throw new Error('[MapManager] currentSection is not set');
    }

    return this.segment.currentSection;
  }

  private get inputsCache(): InputsCache {
    return this.template.assets.inputs as unknown as InputsCache;
  }

  addMap = (map: Map): void => {
    let mappedInputs = '';
    let mappedOutputs = '';

    for (const input of map.inputs) {
      mappedInputs += `[${this.mapInputsVariables(input)}]`;
    }

    for (const output of map.outputs) {
      mappedOutputs += `[${output}]`;
      this.segment.mapsList.push(output);
    }

    // Manage optional attributs
    map.options ??= {};
    map.filters ??= [];

    if ((map.options.useSectionFilters || Object.keys(map.filters).length === 0) && this.currentSection.filters) {
      map.filters = [
        // Add background filters
        ...map.filters,
        ...this.currentSection.filters,
      ];
    }

    // Process single filters
    const filtersMapList = map.filters.map((filter) => this.filterManager.addFilter(filter));

    this.segment.filtersMapList.push(mappedInputs + filtersMapList.join(',') + mappedOutputs);
  };

  private readonly buildAnimationInputsForFirstFrame = (videoInputIncrement: number): string[] => {
    const lastMap = (this.segment.mapsList as ArrayWithAt<string>).at(-1);

    return lastMap
      ? // Concat with the last frame of previous animation
        [lastMap, `${videoInputIncrement + 1}:v`]
      : // Concat with the last frame
        [`${videoInputIncrement}:v`, `${videoInputIncrement + 1}:v`];
  };

  addMapAnimation = (input: MapAnimationInput, frame: number): void => {
    let videoInputIncrement = this.getVideoInputIncrement();
    videoInputIncrement += this.segment.inputsMapCount;

    let useSectionFilters = false;
    const frequency = input.options.frequency;

    let inputs = [`${input.name}_${frame - 1}`, `${videoInputIncrement}:v`];
    const outputs = [`${input.name}_${frame}`];
    const start = (frame - 1) * frequency;
    let end = frame * frequency;

    // Persist last frame on screen
    if (this.hasLastFrameAnimationPersisted(input, frame)) {
      end = this.currentSection.options?.duration ?? end;
    }

    const filters = [
      {
        type: 'overlay',
        value: input.options.overlay,
        range: `start=${start}:end=${end}`,
      },
      {
        type: 'scale',
        value: input.options.scale,
      },
      // Add extra filters
      ...input.filters,
    ];

    // Concat main video for the first frame only
    if (frame === 1) {
      inputs = this.buildAnimationInputsForFirstFrame(videoInputIncrement);

      // Apply filters for first frame of first animation
      if (this.segment.inputsMapCount === 0) {
        useSectionFilters = true;
      }
    }

    // Increment inputs count
    this.segment.inputsMapCount++;

    this.addMap({
      inputs,
      filters,
      outputs,
      options: {
        useSectionFilters,
      },
    });
  };

  getVideoInputIncrement = (): number => {
    let increment = 0;

    switch (this.currentSection.type) {
      case 'project_video':
        increment = 0;
        break;
      case 'video': {
        // 0 is used by fake audio when a video section is reused and not muted
        const sectionOptions = this.currentSection.options;

        increment = !sectionOptions?.useVideoSection || sectionOptions.muteSection === false ? 0 : 1;
        break;
      }
      default:
        increment = 1;
    }

    return increment;
  };

  hasLastFrameAnimationPersisted = (input: MapAnimationInput, frame: number): boolean => {
    if (input.options.persistent) {
      if (!input.options.frames) {
        // Option frames is optional with Zip animation
        const cached = this.inputsCache[input.name];
        input.options.frames = Array.isArray(cached) ? cached.length : 0;
      }

      if (frame === input.options.frames) {
        return true;
      }
    }

    return false;
  };

  /**
   * Replace variables in inputs
   */
  mapInputsVariables = (value: string): string => {
    const section = this.currentSection;
    const inputs = section.inputs as unknown as SectionInputsCache | undefined;

    let result = value;

    if (inputs && Object.keys(inputs).length > 0) {
      // `@video` is anchored to the whole string, so it can only ever match once.
      // Resolve it a single time instead of re-scanning on every input.
      result = result.replace(/^@video$/g, `${this.getVideoInputIncrement()}:v`);

      let hasAnimation = false;

      for (const key of Object.keys(inputs)) {
        // Manage last input for animation
        if (inputs[key].type === 'frame') {
          result = result.replace(
            new RegExp(`@${inputs[key].name}`, 'g'),
            `${inputs[key].name}_${inputs[key].options.frames}`
          );
          hasAnimation = true;

          continue;
        }

        let increment = this.getVideoInputIncrement();

        increment += hasAnimation ? this.segment.inputsMapCount + 1 : parseInt(key, 10) + 1;

        result = result.replace(new RegExp(`@${inputs[key].name}`, 'g'), `${increment}:v`);
      }
    }

    return result;
  };
}

export default MapManager;
