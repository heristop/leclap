import { injectable, inject, container } from 'tsyringe';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type { Filter, MapAnimationInput, Section, SectionOptions } from '@/core/types';
import type Template from '../core/models/Template';
import type Project from '../core/models/Project';
import type Segment from '../core/models/Segment';
import type AssetManager from '../editor/managers/AssetManager';
import type VariableManager from '../editor/managers/VariableManager';
import type MapManager from '../editor/managers/MapManager';
import type FilterManager from '../editor/managers/FilterManager';
import type FormattersManager from '../editor/managers/FormatterManager';
import { assertSafeArgToken } from '@/core/argGuard';
import { compileSugarLayers, compileGlobalDecorations } from './presets/registry';
import { buildSingleFileAnimationSource, buildSingleFileImageSource, buildGradientSource } from './inputSources';
import { buildAudioFadeArg } from './audioFade';
import { resolveVideoCodec, isHardwareCodec, buildPixFmtArg, buildVideoEncoderArgs } from '@/core/encoding';
import type { BackgroundLayer } from '../schemas/template.schemas';

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
    return resolveVideoCodec(this.project.config);
  }

  /** True when the selected encoder is a hardware one (h264_mediacodec / h264_videotoolbox). */
  protected isHardwareCodec(): boolean {
    return isHardwareCodec(this.project.config);
  }

  /** `-pix_fmt yuv420p` for software encoders; empty for hardware (the filtergraph sets the format). */
  protected pixFmtArg(): string {
    return buildPixFmtArg(this.project.config);
  }

  /** Full `-c:v …` args for re-encoded clips — see `buildVideoEncoderArgs` for the per-encoder rules. */
  protected videoEncoderArgs(): string {
    return buildVideoEncoderArgs(this.project.config);
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
    // Output orientation (portrait W:H swap) is resolved once in TemplateDirector.config, not here:
    // a per-segment swap re-applied on the shared project config and alternated portrait/landscape
    // across segments, stretching the recorded clip.
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

    if (opts?.backgroundColor) {
      // Guard the RESOLVED color (variables/colorN already substituted by normalizeBackgroundColor):
      // it is interpolated unquoted into the `color=` lavfi source, so whitespace would inject argv.
      // The color fills the frame whether or not assets composite over it — an asset-less solid
      // color_background must still use its own color (not a transparent placeholder, which is white).
      const bgColor = assertSafeArgToken(opts.backgroundColor, 'backgroundColor');
      const scale = this.project.config.videoConfig?.scale?.replace(':', 'x') ?? '';
      const duration = opts.duration ?? '';

      // Manage background color input
      this.sources.push(`-f lavfi -i color=c=${bgColor}:s=${scale}:d=${duration}`);
    }

    for (const value of Object.values(inputsAsset)) {
      // Animation inputs carry their own `-i` (with `-framerate`/`-stream_loop`/`-c:v` flags) and are
      // pushed verbatim; plain media values are bare staged paths wrapped here as a `-i` source token.
      if (value.startsWith('-')) {
        this.sources.push(value);
        continue;
      }

      this.sources.push(`-i ${assertSafeArgToken(value, 'asset source')}`);
    }
  };

  buildMaps = async (): Promise<void> => {
    this.segment.inputsAsset = [];

    const inputsAsset = this.segment.inputsAsset as unknown as InputsAssetMap;
    const inputs = this.section.inputs ?? [];

    // Stream index of each input in section order. The main video sits at `getVideoInputIncrement()`;
    // asset inputs follow it. When the section's base media is itself the leading input — image_background's
    // pictureUrl (and video's videoUrl) are injected by AssetManager.prepareAssets as the first input named
    // after the section — that input occupies the base slot, so overlays after it are numbered from there.
    // Otherwise the base is a separate source (color lavfi / useVideoSection) and assets start one slot later.
    const baseIsFirstInput = inputs[0]?.name === this.section.name && inputs[0]?.type !== 'animation';
    let inputIndex = this.mapManager.getVideoInputIncrement() + (baseIsFirstInput ? 0 : 1);
    const videoScale = this.project.config.videoConfig?.scale ?? '1280:720';
    const pendingAnimations: Array<{ input: MapAnimationInput; index: number }> = [];

    // Stage every input as one `-i` in section order (stable stream indices), deferring the animation
    // overlay maps so gradient layers can composite UNDER them.
    for (const input of inputs) {
      const source = this.resolveAnimationSource(input);

      if (source !== undefined) {
        inputsAsset[`asset_${input.name}`] = source;
        pendingAnimations.push({ input: input as MapAnimationInput, index: inputIndex });
      }

      if (source === undefined) {
        // Plain staged media (e.g. an image_background picture or a watermark).
        inputsAsset[`asset_${input.name}`] = this.assetManager.fetchCachedMedia(input);
      }

      inputIndex++;
    }

    // Gradient layers are the BACKGROUND: composite them first (the first overlay bakes the section
    // filters), then the animation overlays on top — so the final mapped pad is an animation overlay,
    // not the gradient (which would otherwise overwrite the output and drop the overlays). The video
    // leg is normalized to the output scale before compositing so full-frame animations fill the frame.
    this.buildGradientLayers(inputIndex, inputsAsset);

    for (const animation of pendingAnimations) {
      this.mapManager.addAnimationOverlay(animation.input, animation.index, videoScale);
    }
  };

  /**
   * Resolves the `-i` source fragment for an animation input, or undefined when the input is plain
   * media. A single-file animated input (`.apng`/`.webp`/`.gif`/`.webm`) becomes one `-i`.
   */
  private readonly resolveAnimationSource = (input: {
    type?: string;
    url?: string;
    name: string;
  }): string | undefined => {
    // A still-image overlay takes the same overlay path as an animation (positioned/scaled via
    // addAnimationOverlay), differing only in its `-i` source (held with `-loop 1`, not stream-looped).
    if (input.type === 'image') {
      return buildSingleFileImageSource(this.assetManager.fetchCachedMedia(input));
    }

    if (input.type !== 'animation') {
      return undefined;
    }

    const url = input.url ?? '';

    if (url.endsWith('.zip')) {
      // `.zip` frame sequences are unsupported: only single-file animated formats decode on every
      // platform (Node, browser-WASM, on-device) without an extraction step.
      throw new Error(
        `animation "${input.name}": ZIP frame-sequence animations are no longer supported — ` +
          `use a single-file animated format (.apng, .webp, .gif or .webm).`
      );
    }

    if (/\.(apng|webp|gif|webm)$/i.test(url)) {
      return buildSingleFileAnimationSource(input as MapAnimationInput, this.assetManager.fetchCachedMedia(input));
    }

    return undefined;
  };

  /**
   * Compiles each `gradient` background layer (color_background sections) into one lavfi `gradients`
   * input + one overlay map compositing it over the main stream at the layer's x/y, honoring opacity.
   *
   * ORDERING: the first gradient map carries `useSectionFilters`, so the section's authored chain
   * (drawbox/drawtext/etc.) is applied to the main stream BEFORE the gradient is overlaid — i.e. the
   * gradient composites AFTER those filters. The current maps pipeline (one linear chain per map,
   * section filters folded into the first map) forces this overlay-after-filters order; the visual
   * difference is acceptable for v1.
   */
  private readonly buildGradientLayers = (firstGradientIndex: number, inputsAsset: InputsAssetMap): void => {
    const layers = (this.section.options?.layers as BackgroundLayer[] | undefined) ?? [];
    const scale = this.project.config.videoConfig?.scale ?? '1280:720';
    const duration = this.section.options?.duration ?? 0;

    let gradientIndex = firstGradientIndex;

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];

      if (!layer.gradient) {
        continue;
      }

      inputsAsset[`gradient_${i}`] = buildGradientSource(layer, scale, duration);
      this.mapManager.addGradientOverlay(layer, gradientIndex, `gradient_layer_${i}`);
      gradientIndex++;
    }
  };

  buildFilters = async (): Promise<void> => {
    // Initialize filters if not set
    this.section.maps ??= [];
    this.section.filters ??= [];

    const opts = this.section.options;

    const overlaySugar = this.injectSugarFilters(opts);

    // Force ratio (opts?.forceAspectRatio !== false is true when opts is undefined,
    // so the RHS opts.forceOriginalAspectRatio is only reached when opts is defined).
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

    // When the section composites an overlay graph (animation/gradient maps), the linear filtersList
    // is ignored — so overlay-class sugar (caption/lowerThird text) is chained ONTO the final map
    // instead, drawing on top of the overlay rather than being dropped.
    this.appendOverlayChain(overlaySugar);

    this.formatFilters();
  };

  /**
   * Chains overlay-class sugar (text) onto the final composited pad when the section has an overlay
   * graph. No-op when there is no map (the text was already placed in the linear chain). Routing here
   * — rather than as section filters — keeps the text visible above animation/gradient overlays.
   */
  private readonly appendOverlayChain = (overlayFilters: Filter[]): void => {
    const lastPad = this.segment.mapsList.at(-1);

    if (overlayFilters.length === 0 || lastPad === undefined) {
      return;
    }

    const compiled = overlayFilters.map((filter) => this.filterManager.addFilter(filter)).join(',');
    const outPad = `${this.section.name}_text`;

    this.segment.filtersMapList.push(`[${lastPad}]${compiled}[${outPad}]`);
    this.segment.mapsList.push(outPad);
  };

  /**
   * Prepends structured-sugar filters to the section's authored filter list, in the order fixed by
   * the SUGAR_COMPILERS registry. Background-class sugar (layers/motion/grade/look) always prepends to
   * the linear chain. Overlay-class sugar (caption/lowerThird text) prepends too WHEN there is no
   * overlay graph; when an animation/gradient graph already exists, it is returned for the caller to
   * chain onto the final map (so it draws on top). Called before prependScaleFilters so scale/sar
   * remain first in the chain.
   */
  private readonly injectSugarFilters = (opts: SectionOptions | undefined): Filter[] => {
    const scale = this.project.config.videoConfig?.scale ?? '1280:720';
    // Real footage drives zoompan one output frame per input frame (no time-stretch) and calibrates
    // the Ken Burns curve over the clip's true length. project_video clips are usually shorter than
    // their declared options.duration; their probed length is filled into buildInfos.durations by
    // TemplateDirector.calculateTotalLength before segments build, so read it here.
    const isVideo = this.section.type === 'project_video' || this.section.type === 'video';
    const probedDuration = isVideo ? this.project.buildInfos.durations[this.section.name] : undefined;
    const duration = probedDuration ?? opts?.duration ?? 0;
    const ctx = { duration, scale, fps: 30, isVideo };

    const sectionSugar = compileSugarLayers(this.section, ctx);
    // Global decorations (the whole-video sugar siblings) are fanned out onto this section here, reusing
    // the same layer routing and the section's own text formatting — author once in `global`, applied to
    // every section. NOTE: like all background sugar, global look/grade still bakes only into the linear
    // chain, so on a section with an animation overlay graph it is bypassed (a pre-existing limitation).
    const globalSugar = compileGlobalDecorations(this.template.descriptor.global, this.section.name, ctx);

    const background = [...sectionSugar.background, ...globalSugar.background];
    const overlay = [...sectionSugar.overlay, ...globalSugar.overlay];
    const hasOverlayGraph = this.segment.filtersMapList.length > 0;

    this.section.filters = [...background, ...(hasOverlayGraph ? [] : overlay), ...(this.section.filters ?? [])];

    return hasOverlayGraph ? overlay : [];
  };

  /**
   * Builds the `-af` argument string for audio fades on this section, or returns '' if
   * no fades are configured or the section is muted (fades on a muted track are pointless).
   * Delegates to the pure module-level buildAudioFadeArg to keep this class within line limits.
   */
  protected buildAudioFadeArg = (): string => buildAudioFadeArg(this.section.options);

  private readonly prependScaleFilters = (opts: SectionOptions | undefined): void => {
    const baseScale = this.project.config.videoConfig?.scale ?? '';
    // Default (forceAspectRatio): COVER — scale up until the frame is filled, then crop the overflow, so
    // a source whose aspect differs from the output (e.g. a portrait clip in a square template) fills the
    // frame WITHOUT being stretched. A bare `scale=W:H` would deform it; this preserves the content ratio.
    let scaleFilter = baseScale ? `${baseScale}:force_original_aspect_ratio=increase,crop=${baseScale}` : baseScale;

    if (opts?.forceOriginalAspectRatio) {
      // CONTAIN — letterbox: keep the whole frame visible with bars instead of cropping.
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
