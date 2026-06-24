import { inject, injectable } from 'tsyringe';
import type Segment from '../../core/models/Segment';
import type { Section, Map, MapAnimationInput, ChromaKey } from '@/core/types';
import type { BackgroundLayer } from '../../schemas/template.schemas';
import { buildAnimationLegFilters, overlayMotionExpr } from '../inputSources';
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
   * The animation is one `-i` input (a single `.apng`/`.webp`/`.gif`/`.webm` file) sitting at
   * stream index `inputIndex`. We overlay
   * it onto the main video (`getVideoInputIncrement():v`) and emit a pad named after the input
   * so authored maps can reference it as `@<name>` (resolved by `mapInputsVariables`).
   *
   * `eof_action=repeat` freezes the last animation frame for the rest of the section when
   * `persistent` is set; `pass` lets the main video show through once the animation ends.
   *
   * BOTH legs are scaled to the output resolution BEFORE the overlay: the main-video leg is
   * normalized to `videoScale` and the animation leg to its declared `options.scale`. Without this
   * the animation composites onto the raw (often larger) input and the section's trailing scale
   * shrinks the whole frame — pushing a full-screen animation into the top-left corner. Per-input
   * filters and the section chain (blur/draw/fade) still run after the overlay, preserving layering.
   * The first animation of the section carries `useSectionFilters`.
   */
  // Builds the background the first section animation composites onto: normalize the raw video leg to
  // the output resolution, then bake the section's authored chain (blur/draw/fade) into it — so the
  // animation overlays ON TOP of the finished background rather than being blurred/shrunk with it
  // (which buried full-frame borders behind the blur). Returns the pad to use as the overlay base.
  private readonly buildAnimationBackground = (name: string, videoStream: string, videoScale: string): string => {
    let baseStream = videoStream;

    // unshift keeps the normalize pad defined before the background map that consumes it. COVER (scale up
    // to fill, then crop the overflow) preserves the clip's aspect — a bare `scale=W:H` would stretch a
    // source whose ratio differs from the output (e.g. a portrait clip under a 1:1 square template).
    if (videoScale) {
      const normalizedPad = `${name}_norm`;
      this.segment.filtersMapList.unshift(
        `[${videoStream}]scale=${videoScale}:force_original_aspect_ratio=increase,crop=${videoScale},setsar=1[${normalizedPad}]`
      );
      baseStream = normalizedPad;
    }

    // Only build a background map when the section has filters to bake in; otherwise the animation
    // overlays straight onto the (normalized) video leg.
    if ((this.currentSection.filters?.length ?? 0) > 0) {
      const backgroundPad = `${name}_bg`;
      this.addMap({
        inputs: [baseStream],
        filters: [],
        outputs: [backgroundPad],
        options: { useSectionFilters: true },
      });
      baseStream = backgroundPad;
    }

    return baseStream;
  };

  addAnimationOverlay = (input: MapAnimationInput, inputIndex: number, videoScale = ''): void => {
    const videoStream = `${this.getVideoInputIncrement()}:v`;
    const eofAction = input.options.persistent ? 'repeat' : 'pass';
    const position = input.options.position || '0:0';

    // First animation of the section builds the background (normalize + section filters) on the main
    // video leg; later animations chain off the prior overlay output instead.
    const isFirstOverlay = this.segment.inputsMapCount === 0;
    const baseStream = isFirstOverlay
      ? this.buildAnimationBackground(input.name, videoStream, videoScale)
      : (this.segment.mapsList.at(-1) ?? videoStream);

    // Prepare the animation leg before the overlay: scale it to its declared size and fade it when
    // opacity < 1 (shared with the whole-video AnimationComposer so both composite identically).
    const legFilters = buildAnimationLegFilters(input.options);

    // An optional `motion` animates the entrance: slide/rise emit overlay x/y time-expressions; fade
    // adds an alpha fade-in to the overlay leg (needs an rgba frame first).
    const motion = overlayMotionExpr(input.options.motion, position);

    if (motion.legFilter) {
      if (!legFilters.includes('format=rgba')) {
        legFilters.push('format=rgba');
      }

      legFilters.push(motion.legFilter);
    }

    let animationLeg = `${inputIndex}:v`;

    if (legFilters.length > 0) {
      const animationPad = `${input.name}_src`;
      this.segment.filtersMapList.unshift(`[${inputIndex}:v]${legFilters.join(',')}[${animationPad}]`);
      animationLeg = animationPad;
    }

    this.segment.inputsMapCount++;

    // Moving entrances use the named, single-quoted overlay form so the comma-bearing time expressions
    // are not mis-parsed as extra filter options; otherwise the static positional "x:y" form.
    const overlayValue =
      motion.x || motion.y
        ? `x='${motion.x}':y='${motion.y}':eof_action=${eofAction}`
        : `${position}:eof_action=${eofAction}`;

    // The animation overlays on top of the already-filtered background; no section filters here.
    // `input.filters` is optional in the schema (builder-authored inputs omit it), so default to none.
    this.addMap({
      inputs: [baseStream, animationLeg],
      filters: [{ type: 'overlay', value: overlayValue }, ...(input.filters ?? [])],
      outputs: [input.name],
      options: { useSectionFilters: false },
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

  /**
   * Removes a solid screen colour from the section clip and composites it over a solid background —
   * a green/blue-screen key. The graph is INVERTED relative to addAnimationOverlay (the background is
   * the base, the clip the overlay), but it needs NO extra `-i` input: the clip is `split`, one leg is
   * painted a flat colour by `drawbox` to become the background, the other is keyed and overlaid back.
   * Because no input is added, stream indices never shift (unlike the no-audio anullsrc fix).
   *
   * v1 is solid-background only (no simultaneous animation overlay or background image). The graph is a
   * single self-contained filter_complex from the video stream to `[ck_out]`, which becomes the final
   * mapped pad; the section's own scale chain is folded in so the clip is sized to the output first.
   *
   * `videoInputIndex` is the segment's authoritative clip stream (VideoSegment shifts it to 1 when it
   * prepends blank audio) — NOT getVideoInputIncrement, which disagrees for video+videoUrl sections.
   */
  addChromakeyComposite = (chromaKey: ChromaKey, videoInputIndex: number, videoScale = ''): void => {
    const videoStream = `${videoInputIndex}:v`;
    const color = this.formattersManager.formatColor(chromaKey.color);
    const similarity = chromaKey.similarity ?? 0.3;
    const blend = chromaKey.blend ?? 0.1;
    const background = this.formattersManager.formatColor(
      chromaKey.background ?? this.currentSection.options?.backgroundColor ?? 'black'
    );

    const scaleChain = videoScale
      ? `scale=${videoScale}:force_original_aspect_ratio=increase,crop=${videoScale},setsar=1,`
      : '';

    this.segment.filtersMapList.push(
      `[${videoStream}]${scaleChain}split[ck_a][ck_b];` +
        `[ck_a]drawbox=x=0:y=0:w=iw:h=ih:color=${background}@1:t=fill[ck_bg];` +
        `[ck_b]colorkey=${color}:${similarity}:${blend},format=rgba[ck_keyed];` +
        `[ck_bg][ck_keyed]overlay=0:0[ck_out]`
    );
    this.segment.mapsList.push('ck_out');
    this.segment.inputsMapCount++;
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
