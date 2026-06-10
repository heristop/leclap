import type { IEventEmitter } from '../platform/AbstractEventManager';
import { inject, injectable } from 'tsyringe';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type Template from '../core/models/Template';
import type Project from '../core/models/Project';
import type { Section } from '@/core/types';
import type MusicComposer from './MusicComposer';

@injectable()
class VideoEditor {
  public emitter: IEventEmitter | undefined;

  constructor(
    @inject('project') private readonly project: Project,
    @inject('template') private readonly template: Template,
    @inject('MusicComposer') private readonly musicComposer: MusicComposer,

    @inject('logger') private readonly logger: AbstractLogger,
    @inject('ffmpegAdapter') private readonly ffmpegAdapter: AbstractFFmpeg,
    @inject('filesystemAdapter')
    private readonly filesystemAdapter: AbstractFilesystem
  ) {}

  private buildConcatCommand(concatFilePath: string, finalOutputPath: string): string {
    return (
      ' -y -f concat -safe 0 -auto_convert 1 ' +
      ` -i ${concatFilePath} ` +
      ` -c copy -movflags +faststart ${finalOutputPath} `
    );
  }

  private async copySingleFile(sourceRaw: string, finalOutputPath: string): Promise<string> {
    const sourceFile = sourceRaw.replace(/^file\s+'?|'?$/g, '').trim();
    await this.filesystemAdapter.copy(sourceFile, finalOutputPath);
    this.logger.info(`[Concat][Command] Copied single file to ${finalOutputPath}`);

    return finalOutputPath;
  }

  private async runConcatCommand(concatFilePath: string, finalOutputPath: string): Promise<string> {
    const command = this.buildConcatCommand(concatFilePath, finalOutputPath);
    this.logger.debug(`[Concat][Command] ffmpeg ${command}`);

    const result = await this.ffmpegAdapter.execute(command);
    this.logger.info(`[Concat] ffmpeg process exited with rc ${result.rc}`);

    if (result.rc === 1) {
      this.project.errors.push('concat');

      throw new Error('[Concat] Errors on concatenation');
    }

    return finalOutputPath;
  }

  concat = async (): Promise<string> => {
    try {
      const buildDir = this.filesystemAdapter.getBuildDir() ?? 'build';
      const finalOutputPath = `${buildDir}/output.mp4`;
      this.project.finalVideo = finalOutputPath;

      const concatFilePath = this.project.buildInfos.fileConcatPath;

      if (!concatFilePath) {
        throw new Error('Concat file path is not defined');
      }

      const fileList = await this.filesystemAdapter.read(concatFilePath);
      const files = fileList.split('\n').filter(Boolean);

      if (files.length === 0) {
        throw new Error('No files to concat in the segments list');
      }

      if (files.length === 1) {
        return await this.copySingleFile(files[0], finalOutputPath);
      }

      return await this.runConcatCommand(concatFilePath, finalOutputPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Concat] Error: ${message}`);

      throw error;
    }
  };

  private async cleanupConcatFile(): Promise<void> {
    const concatFilePath = this.project.buildInfos.fileConcatPath;

    if (concatFilePath) {
      try {
        await this.filesystemAdapter.unlink(concatFilePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Could not delete segments file: ${message}`);
      }
    }
  }

  finalize = async (segments: Section[]): Promise<void> => {
    try {
      // Music is mixed only when the template enables it AND a track actually resolved (buildInfos.
      // musicPath is empty when none is selected). Without a track there's nothing to loop or append —
      // the concat output is already the final video. Probing an empty path would otherwise fail.
      if (
        this.template.descriptor.global?.musicEnabled &&
        this.project.buildInfos.musicPath &&
        this.project.finalVideo
      ) {
        await this.musicComposer.loopMusic();
        await this.musicComposer.appendMusic(segments, this.project.finalVideo);
      }

      if (this.project.errors.length === 0) {
        this.emitter?.emit('finalize', {
          video_source: this.project.finalVideo,
          template_assets: this.template.assets,
        });

        await this.cleanupConcatFile();

        this.emitter?.emit('compilation-progress', 1);
        this.logger.info('[End] project cleaned');

        this.project.clean();
        this.template.clean();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Finalize] Error: ${message}`);
    }
  };
}

export default VideoEditor;
