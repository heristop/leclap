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
import { assertSafeArgToken } from '@/core/argGuard';
import { layersToFilters, motionToFilters, gradeToFilters, lookToFilters } from './presets/looks';
import { captionToFilters } from './presets/captions';
import { buildZipAnimationSource, buildSingleFileAnimationSource, buildGradientSource } from './inputSources';
import { buildAudioFadeArg } from './audioFade';
import { resolveVideoCodec, isHardwareCodec, buildPixFmtArg, buildVideoEncoderArgs } from '@/core/encoding';
import type { Grade, MotionEffect, BackgroundLayer } from '../schemas/template.schemas';

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
    const hasAssets = Object.keys(inputsAsset).length > 0;

    if (opts?.backgroundColor) {
      // Guard the RESOLVED color (variables/colorN already substituted by normalizeBackgroundColor):
      // it is interpolated unquoted into the `color=` lavfi source, so whitespace would inject argv.
      const bgColor = assertSafeArgToken(hasAssets ? opts.backgroundColor : 'white@0.0', 'backgroundColor');
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
    const inputsCache = this.template.assets.inputs as unknown as InputsCache;
    const inputs = this.section.inputs ?? [];

    // Stream index of the input at section-position `i`: the main video sits at
    // `getVideoInputIncrement()`, asset inputs follow it in section order.
    const baseIndex = this.mapManager.getVideoInputIncrement() + 1;

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const source = this.resolveAnimationSource(input, inputsCache);

      if (source !== undefined) {
        // Single image2-sequence or single-file animation input + one overlay map.
        inputsAsset[`asset_${input.name}`] = source;
        this.mapManager.addAnimationOverlay(input as MapAnimationInput, baseIndex + i);
        continue;
      }

      // Process single media (plain staged path).
      inputsAsset[`asset_${input.name}`] = this.assetManager.fetchCachedMedia(input);
    }

    this.buildGradientLayers(baseIndex + inputs.length, inputsAsset);
  };

  /**
   * Resolves the `-i` source fragment for an animation input, or undefined when the input is plain
   * media. ZIP animations become one `-framerate <fps> -i <dir>/<pattern>` image2 sequence (falling
   * back to plain media when no frames extracted); `.apng`/`.webp`/`.gif`/`.webm` become one `-i`.
   */
  private readonly resolveAnimationSource = (
    input: { type?: string; url?: string; name: string },
    inputsCache: InputsCache
  ): string | undefined => {
    if (input.type !== 'animation') {
      return undefined;
    }

    const animation = input as MapAnimationInput;

    if (input.url?.endsWith('.zip') && Boolean(inputsCache[input.name])) {
      const pattern = this.assetManager.resolveAnimationSequencePattern(input.name);

      if (pattern === undefined) {
        // Surface the cause before an authored map referencing @<name> hits an undefined pad.
        this.logger.warn(`animation "${input.name}": ZIP frames have no trailing counter, treating as plain media`);

        return undefined;
      }

      return buildZipAnimationSource(animation, pattern);
    }

    if (/\.(apng|webp|gif|webm)$/i.test(input.url ?? '')) {
      return buildSingleFileAnimationSource(animation, this.assetManager.fetchCachedMedia(animation));
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

    this.injectSugarFilters(opts);

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

    this.formatFilters();
  };

  /**
   * Prepends structured-sugar filters to the section's authored filter list in the
   * deterministic order: layers → motion → grade → look → caption → authored filters.
   * Called before prependScaleFilters so scale/sar remain first in the chain.
   */
  private readonly injectSugarFilters = (opts: SectionOptions | undefined): void => {
    const scale = this.project.config.videoConfig?.scale ?? '1280:720';
    const duration = opts?.duration ?? 0;
    const ctx = { duration, scale, fps: 30 };

    this.section.filters = [
      ...layersToFilters(opts?.layers as BackgroundLayer[] | undefined),
      ...motionToFilters(this.section.motion as MotionEffect[] | undefined, ctx),
      ...gradeToFilters(this.section.grade as Grade | undefined),
      ...lookToFilters(this.section.look),
      ...captionToFilters(this.section.caption),
      ...(this.section.filters ?? []),
    ];
  };

  /**
   * Builds the `-af` argument string for audio fades on this section, or returns '' if
   * no fades are configured or the section is muted (fades on a muted track are pointless).
   * Delegates to the pure module-level buildAudioFadeArg to keep this class within line limits.
   */
  protected buildAudioFadeArg = (): string => buildAudioFadeArg(this.section.options);

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
