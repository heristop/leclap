import { inject, injectable } from 'tsyringe';
import type Segment from '../../core/models/Segment';
import type { Section, Map, MapAnimationInput, Filter } from '@/core/types';
import type { BackgroundLayer } from '../../schemas/template.schemas';
import type FormattersManager from './FormatterManager';
import type FilterManager from './FilterManager';

// Section.inputs is typed as Input[] for schema purposes, but at runtime it holds
// MapAnimationInput objects indexed by string keys (used as a keyed record).
type SectionInputsCache = Record<string, MapAnimationInput>;

@injectable()
class MapManager {
  constructor(
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

  /**
   * Composites one animation input over the main video as a SINGLE overlay map.
   *
   * The animation is one `-i` input (an image2 frame sequence or a single
   * `.webm`/`.gif`/`.apng`/`.webp` file) sitting at stream index `inputIndex`. We overlay
   * it onto the main video (`getVideoInputIncrement():v`) and emit a pad named after the input
   * so authored maps can reference it as `@<name>` (resolved by `mapInputsVariables`).
   *
   * `eof_action=repeat` freezes the last animation frame for the rest of the section when
   * `persistent` is set; `pass` lets the main video show through once the animation ends.
   * Scale and any per-input filters are applied after the overlay, matching the original
   * chained behaviour. The first animation of the section carries `useSectionFilters` so the
   * section's filter chain (blur/draw/fade) is applied to the main video before compositing.
   */
  addAnimationOverlay = (input: MapAnimationInput, inputIndex: number): void => {
    const videoStream = `${this.getVideoInputIncrement()}:v`;
    const eofAction = input.options.persistent ? 'repeat' : 'pass';
    const position = input.options.position || '0:0';

    // First animation of the section applies the section's authored filter chain to the
    // main video leg; later animations chain off the prior overlay output instead.
    const useSectionFilters = this.segment.inputsMapCount === 0;
    const baseStream = useSectionFilters ? videoStream : (this.segment.mapsList.at(-1) ?? videoStream);

    const filters: Filter[] = [
      {
        type: 'overlay',
        value: `${position}:eof_action=${eofAction}`,
      },
    ];

    if (input.options.scale) {
      filters.push({ type: 'scale', value: input.options.scale });
    }

    // Per-input extra filters (authored under the input's `filters`).
    filters.push(...input.filters);

    this.segment.inputsMapCount++;

    this.addMap({
      inputs: [baseStream, `${inputIndex}:v`],
      filters,
      outputs: [input.name],
      options: {
        useSectionFilters,
      },
    });
  };

  /**
   * Composites one gradient layer (a lavfi `gradients` input at `gradientIndex`) over the main
   * stream as a single overlay map. Opacity < 1 fades the gradient leg via
   * `format=rgba,colorchannelmixer=aa=<opacity>` before the overlay.
   *
   * The first overlay map of the section carries `useSectionFilters` so the section's authored
   * filter chain is folded into the main-stream leg (see SegmentBuilder.buildGradientLayers for
   * the resulting overlay-after-filters ordering).
   */
  addGradientOverlay = (layer: BackgroundLayer, gradientIndex: number, outputName: string): void => {
    const useSectionFilters = this.segment.inputsMapCount === 0;
    const videoStream = `${this.getVideoInputIncrement()}:v`;
    const baseStream = useSectionFilters ? videoStream : (this.segment.mapsList.at(-1) ?? videoStream);

    const position = `${layer.x ?? 0}:${layer.y ?? 0}`;
    const opacity = layer.opacity ?? 1;

    // Opacity < 1 fades the gradient leg on its own chain (so the main stream is untouched) before
    // it feeds the overlay. The chain is prepended to the graph so its pad exists when the overlay
    // map references it.
    let gradientLeg = `${gradientIndex}:v`;

    if (opacity < 1) {
      const opacityPad = `${outputName}_op`;
      // unshift, not push: the pad must be defined before the overlay map that consumes it,
      // or ffmpeg fails with an undefined stream specifier.
      this.segment.filtersMapList.unshift(
        `[${gradientIndex}:v]format=rgba,colorchannelmixer=aa=${opacity}[${opacityPad}]`
      );
      gradientLeg = opacityPad;
    }

    this.segment.inputsMapCount++;

    this.addMap({
      inputs: [baseStream, gradientLeg],
      filters: [{ type: 'overlay', value: position }],
      outputs: [outputName],
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

  /**
   * Resolves `@name` input references in a map's `inputs` to concrete stream labels.
   *
   * Each section input is now exactly one `-i` source (no per-frame explosion), so the
   * stream index of the input at position `i` is `getVideoInputIncrement() + 1 + i`: the
   * main video sits at `getVideoInputIncrement()`, and asset inputs follow it in section order.
   *
   * Animation inputs are composited by `addAnimationOverlay` into an overlay pad named after
   * the input, so `@<animName>` resolves to that pad label rather than a raw `:v` stream.
   */
  mapInputsVariables = (value: string): string => {
    const section = this.currentSection;
    const inputs = section.inputs as unknown as SectionInputsCache | undefined;

    let result = value;

    if (inputs && Object.keys(inputs).length > 0) {
      // `@video` is anchored to the whole string, so it can only ever match once.
      // Resolve it a single time instead of re-scanning on every input.
      result = result.replace(/^@video$/g, `${this.getVideoInputIncrement()}:v`);

      const keys = Object.keys(inputs);

      for (let i = 0; i < keys.length; i++) {
        const input = inputs[keys[i]];

        // Animation inputs are composited into an overlay pad named after the input:
        // `@foo` → `foo`, the pad label emitted by addAnimationOverlay (dropping the `@`).
        if (input.type === 'animation') {
          result = result.replace(new RegExp(`@${input.name}`, 'g'), input.name);

          continue;
        }

        const increment = this.getVideoInputIncrement() + 1 + i;

        result = result.replace(new RegExp(`@${input.name}`, 'g'), `${increment}:v`);
      }
    }

    return result;
  };
}

export default MapManager;
