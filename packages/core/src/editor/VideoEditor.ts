import EventEmitter from 'events';
import { inject, injectable } from 'tsyringe';
import AbstractLogger from '../platform/logging/AbstractLogger';
import AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import Template from '../core/models/Template';
import Project from '../core/models/Project';
import { Section } from '@/core/types';
import MusicComposer from './MusicComposer';

@injectable()
class VideoEditor {
  public emitter: EventEmitter;

  constructor(
    private readonly project: Project,
    private readonly template: Template,
    private readonly musicComposer: MusicComposer,

    @inject('logger') private readonly logger: AbstractLogger,
    @inject('ffmpegAdapter') private readonly ffmpegAdapter: AbstractFFmpeg,
    @inject('filesystemAdapter')
    private readonly filesystemAdapter: AbstractFilesystem
  ) {}

  // Make concat return the final path string on success
  concat = async (): Promise<string> => {
    try {
      // Use a fallback if getBuildDir returns undefined
      const buildDir = this.filesystemAdapter.getBuildDir() || 'build';

      // Define the final output path consistently
      const finalOutputPath = `${buildDir}/output.mp4`;
      this.project.finalVideo = finalOutputPath; // Set it on the project model

      // Ensure the concat file exists
      const concatFilePath = this.project.buildInfos.fileConcatPath;
      if (!concatFilePath) {
        throw new Error('Concat file path is not defined');
      }

      // Ensure the concat file has content
      const fileList = await this.filesystemAdapter.read(concatFilePath);
      const files = fileList.split('\n').filter(Boolean);

      if (files.length === 0) {
        throw new Error('No files to concat in the segments list');
      }

      if (files.length === 1) {
        const sourceFile = files[0].replace(/^file\s+'?|'?$/g, '').trim(); // More robust cleaning
        await this.filesystemAdapter.copy(sourceFile, finalOutputPath);
        this.logger.info(`[Concat][Command] Copied single file to ${finalOutputPath}`);
      } else {
        const command =
          ' -y -f concat -safe 0 -auto_convert 1 ' +
          ` -i ${concatFilePath} ` +
          ` -c copy -movflags +faststart ${finalOutputPath} `;
        this.logger.debug(`[Concat][Command] ffmpeg ${command}`);

        const result = await this.ffmpegAdapter.execute(command);
        this.logger.info(`[Concat] ffmpeg process exited with rc ${result.rc}`);

        if (result.rc === 1) {
          this.project.errors.push('concat');
          throw new Error('[Concat] Errors on concatenation');
        }
      }
      // Return the final path on success
      return finalOutputPath;
    } catch (error) {
      this.logger.error(`[Concat] Error: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  /**
   * Attach mounted video to the current project
   */
  // Finalize doesn't need to return the path, concat does. Keep return type void.
  finalize = async (segments: Section[]): Promise<void> => {
    try {
      // Append music if option is enabled
      // Ensure finalVideo path is set before this runs
      if (this.template.descriptor.global?.musicEnabled && this.project.finalVideo) {
        await this.musicComposer.loopMusic();
        await this.musicComposer.appendMusic(segments, this.project.finalVideo);
      }

      // Finalize only if no errors had been rejected
      if (this.project.errors.length === 0) {
        // Call event
        this.emitter.emit('finalize', {
          video_source: this.project.finalVideo || '',
          template_assets: this.template.assets,
        });

        // Delete concatenation file if it exists
        const concatFilePath = this.project.buildInfos.fileConcatPath;
        if (concatFilePath) {
          try {
            await this.filesystemAdapter.unlink(concatFilePath);
          } catch (e) {
            this.logger.warn(`Could not delete segments file: ${e.message}`);
          }
        }

        this.emitter.emit('compilation-progress', 1);
        this.logger.info('[End] project cleaned');

        this.project.clean();
        this.template.clean();
      }
    } catch (error) {
      this.logger.error(`[Finalize] Error: ${error.message || 'Unknown error'}`);
    }
  };
}

export default VideoEditor;
