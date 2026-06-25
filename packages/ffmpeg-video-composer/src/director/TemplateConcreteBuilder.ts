import { inject, injectable } from 'tsyringe';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import { hasVirtualFilesystem, type default as AbstractFFmpeg } from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type { Section, ProjectConfig } from '@/core/types';
import type Project from '../core/models/Project';
import SegmentFactory from '../editor/factories/SegmentFactory';
import type SegmentBuilder from '../editor/SegmentBuilder';

function hasInputsAsset(value: unknown): value is { inputsAsset: Record<string, string> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'inputsAsset' in value &&
    typeof (value as Record<string, unknown>).inputsAsset === 'object' &&
    (value as Record<string, unknown>).inputsAsset !== null
  );
}

@injectable()
class TemplateConcreteBuilder {
  constructor(
    @inject('project') private readonly project: Project,

    @inject('logger') private readonly logger: AbstractLogger,
    @inject('ffmpegAdapter') private readonly ffmpegAdapter: AbstractFFmpeg,
    @inject('filesystemAdapter') private readonly filesystemAdapter: AbstractFilesystem
  ) {}

  /**
   * Build a segment: create it via the factory and run its (filtergraph/command) init. Returns the
   * built `SegmentBuilder` handle plus the init result. The handle carries everything render() needs
   * (the ffmpeg command string + destination), so build can run serially — required, since building
   * mutates the shared `Segment` DI singleton — while render() runs statelessly and may be pooled.
   */
  build = async (section: Section, projectConfig: ProjectConfig): Promise<{ segment: SegmentBuilder; ok: boolean }> => {
    const segment = new SegmentFactory(projectConfig).create(section);

    if (section.type === 'project_video') {
      segment.getProject().config = projectConfig;
    }

    this.logger.info(`[${section.name}][BuildPart] init`);

    const ok = await segment.init();

    return { segment, ok };
  };

  /**
   * Execute FFmpeg rendering for an already-built segment. Stateless w.r.t. the builder instance
   * (everything comes from the passed `segment`/`section`), so several renders may run concurrently
   * on adapters that support it.
   */
  render = async (segment: SegmentBuilder, section: Section): Promise<void> => {
    const command = segment.getCommand();

    if (!command) {
      this.logger.info(`[${section.name}][RenderPart] No command available`);
    }

    this.logger.info(`[${section.name}][RenderPart] segment.destination = ${segment.destination}`);
    this.logger.debug(`[${section.name}][Command] ffmpeg ${command}`);

    if (hasVirtualFilesystem(this.ffmpegAdapter)) {
      await this.writeInputFilesToWasm(segment, section);
    }

    const result = await this.ffmpegAdapter.execute(command);
    this.logger.info(`[${section.name}][RenderPart] ffmpeg process exited with rc ${result.rc}`);

    if (result.rc === 1) {
      this.project.errors.push(section.name);
    }

    if (result.rc === 0) {
      await this.handleSuccessResult(segment, section);
    }

    this.logger.info(`[${section.name}][RenderPart] finalized`);
  };

  private async handleSuccessResult(segment: SegmentBuilder, section: Section): Promise<void> {
    if (!hasVirtualFilesystem(this.ffmpegAdapter)) {
      await this.handleNativeSuccessResult(segment, section);

      return;
    }

    await this.handleWasmSuccessResult(segment, section);
  }

  private async handleNativeSuccessResult(segment: SegmentBuilder, section: Section): Promise<void> {
    // `stat` resolves to a boolean (it never throws), so the result must be checked: a missing
    // output despite a zero exit code (e.g. the segment command never got configured and defaulted
    // to `-version`) has to surface as an error rather than be silently logged as "exists".
    const exists = await this.filesystemAdapter.stat(segment.destination);

    if (!exists) {
      this.logger.error(`[${section.name}][RenderPart] output file not found at ${segment.destination}`);
      this.project.errors.push(section.name);

      return;
    }

    this.logger.info(`[${section.name}][RenderPart] output file exists at ${segment.destination}`);
  }

  private async handleWasmSuccessResult(segment: SegmentBuilder, section: Section): Promise<void> {
    try {
      const outputFile = segment.destination;
      this.logger.info(`[${section.name}][RenderPart] Looking for WASM output: ${outputFile}`);

      if (await this.filesystemAdapter.stat(outputFile)) {
        this.logger.info(`[${section.name}][RenderPart] WASM output already mirrored to filesystem: ${outputFile}`);

        return;
      }

      const { data, fileLocation } = await this.findWasmOutputFile(outputFile, section);

      if (!(data && fileLocation)) {
        const error = `Output file not found in WASM. Expected: ${outputFile}`;
        this.logger.error(`[${section.name}][RenderPart] ${error}`);
        this.project.errors.push(section.name);

        throw new Error(error);
      }

      await this.filesystemAdapter.writeFile(segment.destination, data);
      this.logger.info(`[${section.name}][RenderPart] Transferred from WASM to IndexedDB: ${fileLocation}`);

      if (hasVirtualFilesystem(this.ffmpegAdapter)) {
        await this.ffmpegAdapter.deleteFile(fileLocation);
      }
    } catch (error) {
      const errorMsg = `Failed to read output file from FFmpeg: ${String(error)}`;
      this.logger.error(`[${section.name}][RenderPart] ${errorMsg}`);
      this.project.errors.push(section.name);

      throw new Error(errorMsg);
    }
  }

  private async findWasmOutputFile(
    outputFile: string,
    section: Section
  ): Promise<{ data: Uint8Array | null; fileLocation: string | null }> {
    if (!hasVirtualFilesystem(this.ffmpegAdapter)) {
      return { data: null, fileLocation: null };
    }

    try {
      // Try reading directly
      const data = await this.ffmpegAdapter.readFile(outputFile);
      this.logger.info(`[${section.name}][RenderPart] Found output at: ${outputFile}`);

      return { data, fileLocation: outputFile };
    } catch {
      return this.searchWasmDirectories(outputFile, section);
    }
  }

  private async searchWasmDirectories(
    outputFile: string,
    section: Section
  ): Promise<{ data: Uint8Array | null; fileLocation: string | null }> {
    if (!hasVirtualFilesystem(this.ffmpegAdapter)) {
      return { data: null, fileLocation: null };
    }

    this.logger.info(`[${section.name}][RenderPart] Output not found at root, checking directories...`);

    const files = await this.ffmpegAdapter.listDir('/');
    this.logger.info(`[${section.name}][RenderPart] Files in WASM root: ${files.map((f) => f.name).join(', ')}`);

    const fromTmp = await this.searchWasmTmpDir(outputFile, section);

    if (fromTmp.data) {
      return fromTmp;
    }

    const foundInRoot = files.find((f) => f.name === outputFile);

    if (foundInRoot && hasVirtualFilesystem(this.ffmpegAdapter)) {
      const data = await this.ffmpegAdapter.readFile(outputFile);

      return { data, fileLocation: outputFile };
    }

    return { data: null, fileLocation: null };
  }

  private async searchWasmTmpDir(
    outputFile: string,
    section: Section
  ): Promise<{ data: Uint8Array | null; fileLocation: string | null }> {
    if (!hasVirtualFilesystem(this.ffmpegAdapter)) {
      return { data: null, fileLocation: null };
    }

    try {
      const tmpFiles = await this.ffmpegAdapter.listDir('/tmp');
      this.logger.info(`[${section.name}][RenderPart] Files in /tmp: ${tmpFiles.map((f) => f.name).join(', ')}`);

      const tmpFile = tmpFiles.find((f) => f.name === outputFile);

      if (tmpFile) {
        const data = await this.ffmpegAdapter.readFile(`/tmp/${outputFile}`);
        const fileLocation = `/tmp/${outputFile}`;
        this.logger.info(`[${section.name}][RenderPart] Found output in /tmp`);

        return { data, fileLocation };
      }
    } catch (error) {
      this.logger.info(`[${section.name}][RenderPart] Could not check /tmp: ${String(error)}`);
    }

    return { data: null, fileLocation: null };
  }

  private async writeInputFilesToWasm(segment: SegmentBuilder, section: Section): Promise<void> {
    if (!hasVirtualFilesystem(this.ffmpegAdapter)) {
      return;
    }

    const inputAssets = hasInputsAsset(segment) ? segment.inputsAsset : {};

    if (Object.keys(inputAssets).length === 0) {
      this.logger.info(`[${section.name}][WASM] No input assets to load`);

      return;
    }

    this.logger.info(
      `[${section.name}][WASM] Writing ${Object.keys(inputAssets).length} input files to WASM memory...`
    );

    const entries = Object.entries(inputAssets);

    await Promise.all(
      entries.map(async ([key, path]) => {
        await this.writeAssetToWasm(key, path, section);
      })
    );

    this.logger.info(`[${section.name}][WASM] All input files loaded successfully`);
  }

  private async writeAssetToWasm(key: string, path: string, section: Section): Promise<void> {
    if (!hasVirtualFilesystem(this.ffmpegAdapter)) {
      return;
    }

    try {
      const data = await this.filesystemAdapter.readFile(path);
      const fileName = path.split('/').pop() ?? key;
      const fileSizeMB = (data.byteLength / (1024 * 1024)).toFixed(2);

      this.logger.info(`[${section.name}][WASM] Loading ${fileName} (${fileSizeMB} MB)...`);

      if (data.byteLength > 50 * 1024 * 1024) {
        this.logger.warn(`[${section.name}][WASM] Warning: Large file (${fileSizeMB} MB). May cause memory issues.`);
      }

      await this.ffmpegAdapter.writeFile(fileName, data);
      this.logger.info(`[${section.name}][WASM] Successfully wrote: ${fileName}`);
    } catch (error) {
      const errorMsg = `Failed to write input file ${key}: ${String(error)}`;
      this.logger.error(`[${section.name}][WASM] ${errorMsg}`);

      throw new Error(errorMsg);
    }
  }
}

export default TemplateConcreteBuilder;
