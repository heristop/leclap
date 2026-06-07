import { inject, injectable } from 'tsyringe';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import FFmpegWasmAdapter from '../platform/ffmpeg/FFmpegWasmAdapter';
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
  private section!: Section;
  private segment!: SegmentBuilder;

  constructor(
    @inject('project') private readonly project: Project,

    @inject('logger') private readonly logger: AbstractLogger,
    @inject('ffmpegAdapter') private readonly ffmpegAdapter: AbstractFFmpeg,
    @inject('filesystemAdapter') private readonly filesystemAdapter: AbstractFilesystem
  ) { }

  buildPart = async (section: Section, projectConfig: ProjectConfig): Promise<boolean> => {
    this.section = section;
    this.segment = new SegmentFactory(projectConfig).create(section);

    if (section.type === 'project_video') {
      this.segment.getProject().config = projectConfig;
    }

    this.logger.info(`[${section.name}][BuildPart] init`);

    return await this.segment.init();
  };

  /**
   * Execute FFmpeg rendering
   */
  renderPart = async (): Promise<void> => {
    const command = this.segment.getCommand();

    if (!command) {
      this.logger.info(`[${this.section.name}][RenderPart] No command available`);
    }

    this.logger.info(`[${this.section.name}][RenderPart] segment.destination = ${this.segment.destination}`);
    this.logger.debug(`[${this.section.name}][Command] ffmpeg ${command}`);

    if (this.ffmpegAdapter instanceof FFmpegWasmAdapter) {
      await this.writeInputFilesToWasm();
    }

    const result = await this.ffmpegAdapter.execute(command);
    this.logger.info(`[${this.section.name}][RenderPart] ffmpeg process exited with rc ${result.rc}`);

    if (result.rc === 1) {
      this.project.errors.push(this.section.name);
    }

    if (result.rc === 0) {
      await this.handleSuccessResult();
    }

    this.logger.info(`[${this.section.name}][RenderPart] finalized`);
  };

  private async handleSuccessResult(): Promise<void> {
    if (!(this.ffmpegAdapter instanceof FFmpegWasmAdapter)) {
      await this.handleNativeSuccessResult();

      return;
    }

    await this.handleWasmSuccessResult();
  }

  private async handleNativeSuccessResult(): Promise<void> {
    try {
      await this.filesystemAdapter.stat(this.segment.destination);
      this.logger.info(`[${this.section.name}][RenderPart] output file exists at ${this.segment.destination}`);
    } catch {
      this.logger.error(`[${this.section.name}][RenderPart] output file not found`);
      this.project.errors.push(this.section.name);
    }
    this.logger.info(`[${this.section.name}][RenderPart] finalized`);
  }

  private async handleWasmSuccessResult(): Promise<void> {
    try {
      const outputFile = this.segment.destination;
      this.logger.info(`[${this.section.name}][RenderPart] Looking for WASM output: ${outputFile}`);

      const { data, fileLocation } = await this.findWasmOutputFile(outputFile);

      if (!(data && fileLocation)) {
        const error = `Output file not found in WASM. Expected: ${outputFile}`;
        this.logger.error(`[${this.section.name}][RenderPart] ${error}`);
        this.project.errors.push(this.section.name);

        throw new Error(error);
      }

      await this.filesystemAdapter.writeFile(this.segment.destination, data);
      this.logger.info(`[${this.section.name}][RenderPart] Transferred from WASM to IndexedDB: ${fileLocation}`);

      if (this.ffmpegAdapter instanceof FFmpegWasmAdapter) {
        await this.ffmpegAdapter.deleteFile(fileLocation);
      }
    } catch (error) {
      const errorMsg = `Failed to read output file from FFmpeg: ${String(error)}`;
      this.logger.error(`[${this.section.name}][RenderPart] ${errorMsg}`);
      this.project.errors.push(this.section.name);

      throw new Error(errorMsg);
    }
  }

  private async findWasmOutputFile(
    outputFile: string
  ): Promise<{ data: Uint8Array | null; fileLocation: string | null }> {
    if (!(this.ffmpegAdapter instanceof FFmpegWasmAdapter)) {
      return { data: null, fileLocation: null };
    }

    try {
      // Try reading directly
      const data = await this.ffmpegAdapter.readFile(outputFile);
      this.logger.info(`[${this.section.name}][RenderPart] Found output at: ${outputFile}`);

      return { data, fileLocation: outputFile };
    } catch {
      return this.searchWasmDirectories(outputFile);
    }
  }

  private async searchWasmDirectories(
    outputFile: string
  ): Promise<{ data: Uint8Array | null; fileLocation: string | null }> {
    if (!(this.ffmpegAdapter instanceof FFmpegWasmAdapter)) {
      return { data: null, fileLocation: null };
    }

    this.logger.info(`[${this.section.name}][RenderPart] Output not found at root, checking directories...`);

    const files = await this.ffmpegAdapter.listDir('/');
    this.logger.info(`[${this.section.name}][RenderPart] Files in WASM root: ${files.map(f => f.name).join(', ')}`);

    const fromTmp = await this.searchWasmTmpDir(outputFile);

    if (fromTmp.data) {
      return fromTmp;
    }

    const foundInRoot = files.find(f => f.name === outputFile);

    if (foundInRoot && this.ffmpegAdapter instanceof FFmpegWasmAdapter) {
      const data = await this.ffmpegAdapter.readFile(outputFile);

      return { data, fileLocation: outputFile };
    }

    return { data: null, fileLocation: null };
  }

  private async searchWasmTmpDir(
    outputFile: string
  ): Promise<{ data: Uint8Array | null; fileLocation: string | null }> {
    if (!(this.ffmpegAdapter instanceof FFmpegWasmAdapter)) {
      return { data: null, fileLocation: null };
    }

    try {
      const tmpFiles = await this.ffmpegAdapter.listDir('/tmp');
      this.logger.info(`[${this.section.name}][RenderPart] Files in /tmp: ${tmpFiles.map(f => f.name).join(', ')}`);

      const tmpFile = tmpFiles.find(f => f.name === outputFile);

      if (tmpFile) {
        const data = await this.ffmpegAdapter.readFile(`/tmp/${outputFile}`);
        const fileLocation = `/tmp/${outputFile}`;
        this.logger.info(`[${this.section.name}][RenderPart] Found output in /tmp`);

        return { data, fileLocation };
      }
    } catch (error) {
      this.logger.info(`[${this.section.name}][RenderPart] Could not check /tmp: ${String(error)}`);
    }

    return { data: null, fileLocation: null };
  }

  private async writeInputFilesToWasm(): Promise<void> {
    if (!(this.ffmpegAdapter instanceof FFmpegWasmAdapter)) {
      return;
    }

    const inputAssets = hasInputsAsset(this.segment) ? this.segment.inputsAsset : {};

    if (Object.keys(inputAssets).length === 0) {
      this.logger.info(`[${this.section.name}][WASM] No input assets to load`);

      return;
    }

    this.logger.info(`[${this.section.name}][WASM] Writing ${Object.keys(inputAssets).length} input files to WASM memory...`);

    const entries = Object.entries(inputAssets);

    await Promise.all(
      entries.map(async ([key, path]) => {
        await this.writeAssetToWasm(key, path);
      })
    );

    this.logger.info(`[${this.section.name}][WASM] All input files loaded successfully`);
  }

  private async writeAssetToWasm(key: string, path: string): Promise<void> {
    if (!(this.ffmpegAdapter instanceof FFmpegWasmAdapter)) {
      return;
    }

    try {
      const data = await this.filesystemAdapter.readFile(path);
      const fileName = path.split('/').pop() ?? key;
      const fileSizeMB = (data.byteLength / (1024 * 1024)).toFixed(2);

      this.logger.info(`[${this.section.name}][WASM] Loading ${fileName} (${fileSizeMB} MB)...`);

      if (data.byteLength > 50 * 1024 * 1024) {
        this.logger.warn(`[${this.section.name}][WASM] Warning: Large file (${fileSizeMB} MB). May cause memory issues.`);
      }

      await this.ffmpegAdapter.writeFile(fileName, data);
      this.logger.info(`[${this.section.name}][WASM] Successfully wrote: ${fileName}`);
    } catch (error) {
      const errorMsg = `Failed to write input file ${key}: ${String(error)}`;
      this.logger.error(`[${this.section.name}][WASM] ${errorMsg}`);

      throw new Error(errorMsg);
    }
  }
}

export default TemplateConcreteBuilder;
