import EventEmitter from 'events';
import { inject, injectable } from 'tsyringe';
import AbstractLogger from '../platform/logging/AbstractLogger';
import AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import EventManager from '../platform/EventManager';
import VideoEditor from '../editor/VideoEditor';
import MusicComposer from '../editor/MusicComposer';
import { FFMpegInfos, ProjectConfig, Section, TemplateDescriptor } from '@/core/types';
import Project from '../core/models/Project';
import Template from '../core/models/Template';
import TemplateConcreteBuilder from './TemplateConcreteBuilder';

@injectable()
class TemplateDirector {
  private readonly emitter: EventEmitter;

  private builder: TemplateConcreteBuilder;
  private stopBuild: boolean = false;

  constructor(
    private readonly eventManager: EventManager,
    private readonly concreteBuilder: TemplateConcreteBuilder,
    private readonly musicComposer: MusicComposer,
    private readonly videoEditor: VideoEditor,

    private project: Project,
    private template: Template,

    @inject('logger') private readonly logger: AbstractLogger,
    @inject('ffmpegAdapter') private readonly ffmpegAdapter: AbstractFFmpeg,
    @inject('filesystemAdapter')
    private readonly filesystemAdapter: AbstractFilesystem
  ) {
    this.emitter = this.eventManager.connect();
    this.emitter.on('task-cancelled', () => (this.stopBuild = true));
    this.videoEditor.emitter = this.emitter;

    this.logger.info('Director class created');
  }

  config = (projectConfig: ProjectConfig, templateDescriptor: TemplateDescriptor): TemplateDirector => {
    this.project.config = projectConfig;
    this.template.descriptor = templateDescriptor;

    this.filesystemAdapter.setBuildDir(this.project.config.buildDir || 'build');
    this.filesystemAdapter.setAssetsDir(this.project.config.assetsDir || 'assets');

    this.project.applyDefault();

    // Log available section-specific videos
    if (this.project.config.userVideoPaths) {
      this.logger.info(
        `TemplateDirector received userVideoPaths with ${Object.keys(this.project.config.userVideoPaths).length} videos for sections:`,
        { sections: Object.keys(this.project.config.userVideoPaths).join(', ') }
      );
    } else {
      this.logger.info('TemplateDirector: No userVideoPaths provided in config');
    }

    return this;
  };

  // Return output path on success, null on failure
  construct = async (): Promise<string | null> => {
    try {
      await this.init();

      // compileVideoSegments now implicitly calls finalizeCompilation which returns the path
      const finalPath = await this.compileVideoSegments();
      // Return the final path if compilation was successful (not stopped and no error)
      if (!this.stopBuild) {
        return finalPath;
      }
    } catch (err) {
      this.fireError(err);

      // If construct fails, fireError is called, which stops the build. Return null.
      return null;
    }

    // Return null if stopped or error occurred
    return null;
  };

  init = async (): Promise<void> => {
    this.project.buildInfos.fileConcatPath = `${this.filesystemAdapter.getBuildDir()}/segments.list`;

    await this.musicComposer.loadMusic();

    await this.filesystemAdapter.write(this.project.buildInfos.fileConcatPath);

    this.logger.info(`[Init] Segment file saved to ${this.project.buildInfos.fileConcatPath}`);
  };

  // Update return type to match what finalizeCompilation returns
  compileVideoSegments = async (): Promise<string | null> => {
    // Filter sections to only include those relevant for video compilation
    const allSections = this.template.descriptor.sections || [];
    const videoSegmentTypes = ['video', 'project_video', 'image_background', 'color_background']; // Add other types if needed
    const videoSegments = allSections.filter((section) => videoSegmentTypes.includes(section.type)); // Add parentheses

    if (videoSegments.length === 0) {
      this.logger.info('No video segments found in the template to compile.'); // Use info instead of warn
      return null; // Or handle as an error?
    }

    await this.calculateTotalLength(videoSegments);

    this.logger.info(`[TemplateDirection] Length: ${this.project.buildInfos.totalLength}`);
    this.project.buildInfos.totalSegments = videoSegments.length;

    await this.processVideoSegments(videoSegments);

    // Call finalizeCompilation and return its result (the path or null)
    if (!this.stopBuild) {
      return await this.finalizeCompilation(videoSegments);
    }
    // Return null if build was stopped before finalization
    return null;
  };

  // calculateTotalLength remains, but filterVideoSections is removed entirely.

  calculateTotalLength = async (segments: Section[]): Promise<void> => {
    for (const segment of segments) {
      let duration = segment.options.duration;

      if (segment.type === 'project_video') {
        duration = await this.getVideoSectionDuration(segment);
      }

      this.project.buildInfos.totalLength += duration;
      this.project.buildInfos.durations[segment.name] = duration;
    }
  };

  getVideoSectionDuration = async (segment: Section): Promise<number> => {
    const sectionInfos = await this.fetchSectionInfos(segment);

    if (!sectionInfos.duration) {
      throw new Error('No section info found');
    }

    return sectionInfos.duration;
  };

  processVideoSegments = async (segments: Section[]): Promise<void> => {
    const promises = [];

    for (const segment of segments) {
      if (this.stopBuild) {
        break;
      }

      const promise = await this.processSingleVideoSegment(segment);
      promises.push(promise);
    }

    await Promise.all(promises);
  };

  processSingleVideoSegment = async (segment: Section): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      try {
        this.addToQueue(segment).then(() => {
          this.updateProgress(segment);
          this.logger.info(`[${segment.name}][Editing] finalized (${Math.round(this.project.progress * 100)}%)`);
          resolve(true);
        });
      } catch (err) {
        this.fireError(err);

        reject(false);
      }
    });
  };

  updateProgress = (segment: Section): void => {
    const { totalLength } = this.project.buildInfos;
    const segmentLength = this.project.buildInfos.durations[segment.name];

    this.project.progress = Math.min(1, this.project.progress + segmentLength / totalLength);
    this.project.buildInfos.currentProgress = this.project.progress;

    this.emitter.emit('compilation-progress', this.project.progress);
  };

  // Make this return the final path from concat
  finalizeCompilation = async (segments: Section[]): Promise<string | null> => {
    // Capture the path returned by concat
    const finalPath = await this.videoEditor.concat();

    // Finalize might modify the file (e.g., add music), but uses the same path
    await this.videoEditor.finalize(segments);

    // Return the path determined by concat
    return finalPath;
  };

  fetchSectionInfos = async (section: Section): Promise<FFMpegInfos> => {
    let source: string;

    this.logger.info(`[fetchSectionInfos] Processing section ${section.name} (${section.type})`);
    if (this.project.config.userVideoPaths) {
      this.logger.info(
        `[fetchSectionInfos] Available userVideoPaths:`,
        Object.keys(this.project.config.userVideoPaths).reduce((obj, key) => {
          obj[key] = true;
          return obj;
        }, {})
      );
    }

    // First check if there's a specific video for this section in userVideoPaths
    if (
      section.type === 'project_video' &&
      this.project.config.userVideoPaths &&
      this.project.config.userVideoPaths[section.name]
    ) {
      source = this.project.config.userVideoPaths[section.name];
      this.logger.info(`[fetchSectionInfos] Using section-specific video for ${section.name}: ${source}`);

      // Check if the file exists
      try {
        await this.filesystemAdapter.stat(source);
        this.logger.info(`[fetchSectionInfos] Verified file exists: ${source}`);
      } catch (error) {
        this.logger.error(`[fetchSectionInfos] Error accessing section-specific video: ${source}`, error);
        // Fall back to default video instead of failing
        source = null;
      }
    }

    // If no section-specific video or it wasn't accessible, try general userVideoPath (backwards compatibility)
    if (!source && section.type === 'project_video' && this.project.config.userVideoPath) {
      source = this.project.config.userVideoPath;
      this.logger.info(`[fetchSectionInfos] Using general userVideoPath for section ${section.name}: ${source}`);

      // Check if the file exists
      try {
        await this.filesystemAdapter.stat(source);
        this.logger.info(`[fetchSectionInfos] Verified file exists: ${source}`);
      } catch (error) {
        this.logger.error(`[fetchSectionInfos] Error accessing userVideoPath: ${source}`, error);
        // Fall back to default video instead of failing
        source = null;
      }
    }

    // If no user videos are available or accessible, use default from assets
    if (!source) {
      const assetsDir = this.filesystemAdapter.getAssetsDir('videos');
      source = `${assetsDir}/${section.name}.mp4`;
      this.logger.info(`[fetchSectionInfos] Using default assets path for section ${section.name}: ${source}`);
    }

    const info = await this.ffmpegAdapter.getInfos(source);

    if (info.duration === null) {
      // Check for null explicitly
      throw new Error(`Duration not found for ${section.name}`);
    }

    return info;
  };

  addToQueue = async (section: Section): Promise<void> => {
    this.builder = this.concreteBuilder;

    // First, build configuration and retrieve updated assets
    // Pass the project config down to the builder
    await this.builder.buildPart(section, this.project.config);

    // Then, compile part with FFmpeg
    await this.builder.renderPart();

    // Prepare music timeline for volume variations
    this.musicComposer.prepareMusicTrack(section);

    // Append file for concat
    await this.append(section);
  };

  append = async (section: Section): Promise<void> => {
    const file = `${this.filesystemAdapter.getBuildDir()}/${section.name}_output.mp4`;
    this.project.buildInfos.videoInputs.push(file);

    await this.filesystemAdapter.append(this.project.buildInfos.fileConcatPath, `file ${file}\n`);

    this.logger.info(`[${section.name}][Append] '${file}'`);
  };

  fireError = (error: unknown): void => {
    globalThis.console.error(error);
    this.logger.error(`[TemplateDirector][Error] ${JSON.stringify(error)}`);

    // Stop the Director build
    this.stopBuild = true;

    // Delete concatenation file
    this.filesystemAdapter.unlink(this.project.buildInfos.fileConcatPath);

    // Fire event
    this.emitter.emit('task-stopped', error);
  };
}

export default TemplateDirector;
