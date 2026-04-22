import { inject, injectable } from 'tsyringe';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type AbstractEventManager from '../platform/AbstractEventManager';
import type { IEventEmitter } from '../platform/AbstractEventManager';
import type VideoEditor from '../editor/VideoEditor';
import type MusicComposer from '../editor/MusicComposer';
import type { FFMpegInfos, ProjectConfig, Section, TemplateDescriptor } from '@/core/types';
import type Project from '../core/models/Project';
import type Template from '../core/models/Template';
import type TemplateConcreteBuilder from './TemplateConcreteBuilder';

@injectable()
class TemplateDirector {
  private readonly emitter: IEventEmitter;

  private builder: TemplateConcreteBuilder;
  private stopBuild = false;

  constructor(
    @inject('eventManager') private readonly eventManager: AbstractEventManager,
    @inject('TemplateConcreteBuilder') private readonly concreteBuilder: TemplateConcreteBuilder,
    @inject('MusicComposer') private readonly musicComposer: MusicComposer,
    @inject('VideoEditor') private readonly videoEditor: VideoEditor,

    @inject('project') private project: Project,
    @inject('template') private template: Template,

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

  construct = async (): Promise<string | null> => {
    try {
      await this.init();

      const finalPath = await this.compileVideoSegments();
      if (!this.stopBuild) {
        return finalPath;
      }
    } catch (err) {
      this.fireError(err);
      return null;
    }

    return null;
  };

  init = async (): Promise<void> => {
    this.project.buildInfos.fileConcatPath = `${this.filesystemAdapter.getBuildDir()}/segments.list`;

    await this.musicComposer.loadMusic();

    await this.filesystemAdapter.write(this.project.buildInfos.fileConcatPath);

    this.logger.info(`[Init] Segment file saved to ${this.project.buildInfos.fileConcatPath}`);
  };

  compileVideoSegments = async (): Promise<string | null> => {
    const allSections = this.template.descriptor.sections || [];
    const videoSegmentTypes = ['video', 'project_video', 'image_background', 'color_background'];
    const videoSegments = allSections.filter((section) => videoSegmentTypes.includes(section.type));

    if (videoSegments.length === 0) {
      this.logger.info('No video segments found in the template to compile.');
      return null;
    }

    await this.calculateTotalLength(videoSegments);

    this.logger.info(`[TemplateDirection] Length: ${this.project.buildInfos.totalLength}`);
    this.project.buildInfos.totalSegments = videoSegments.length;

    await this.processVideoSegments(videoSegments);

    if (!this.stopBuild) {
      return await this.finalizeCompilation(videoSegments);
    }

    return null;
  };

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
    try {
      await this.addToQueue(segment);
      this.updateProgress(segment);
      this.logger.info(`[${segment.name}][Editing] finalized (${Math.round(this.project.progress * 100)}%)`);
      return true;
    } catch (err) {
      this.fireError(err);
      return false;
    }
  };

  updateProgress = (segment: Section): void => {
    const { totalLength } = this.project.buildInfos;
    const segmentLength = this.project.buildInfos.durations[segment.name];

    this.project.progress = Math.min(1, this.project.progress + segmentLength / totalLength);
    this.project.buildInfos.currentProgress = this.project.progress;

    this.emitter.emit('compilation-progress', this.project.progress);
  };

  finalizeCompilation = async (segments: Section[]): Promise<string | null> => {
    const finalPath = await this.videoEditor.concat();
    await this.videoEditor.finalize(segments);
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

    if (
      section.type === 'project_video' &&
      this.project.config.userVideoPaths &&
      this.project.config.userVideoPaths[section.name]
    ) {
      source = this.project.config.userVideoPaths[section.name];
      this.logger.info(`[fetchSectionInfos] Using section-specific video for ${section.name}: ${source}`);

      try {
        await this.filesystemAdapter.stat(source);
        this.logger.info(`[fetchSectionInfos] Verified file exists: ${source}`);
      } catch (error) {
        this.logger.error(`[fetchSectionInfos] Error accessing section-specific video: ${source}`, error);
        source = null;
      }
    }

    if (!source) {
      const assetsDir = this.filesystemAdapter.getAssetsDir('videos');
      source = `${assetsDir}/${section.name}.mp4`;
      this.logger.info(`[fetchSectionInfos] Using default assets path for section ${section.name}: ${source}`);
    }

    const info = await this.ffmpegAdapter.getInfos(source);

    if (info.duration === null) {
      throw new Error(`Duration not found for ${section.name}`);
    }

    return info;
  };

  addToQueue = async (section: Section): Promise<void> => {
    this.builder = this.concreteBuilder;

    await this.builder.buildPart(section, this.project.config);
    await this.builder.renderPart();

    this.musicComposer.prepareMusicTrack(section);
    await this.append(section);
  };

  append = async (section: Section): Promise<void> => {
    const file = `${this.filesystemAdapter.getBuildDir()}/${section.name}_output.mp4`;
    this.project.buildInfos.videoInputs.push(file);

    await this.filesystemAdapter.append(this.project.buildInfos.fileConcatPath, `file ${file}\n`);

    this.logger.info(`[${section.name}][Append] '${file}'`);
  };

  fireError = (error: unknown): void => {
    const errorMessage = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
    this.logger.error(`[TemplateDirector][Error] ${errorMessage}`);

    this.stopBuild = true;
    this.filesystemAdapter.unlink(this.project.buildInfos.fileConcatPath);
    this.emitter.emit('task-stopped', error);
  };
}

export default TemplateDirector;
