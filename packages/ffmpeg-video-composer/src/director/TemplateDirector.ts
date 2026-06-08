import { inject, injectable, registry, type DependencyContainer } from 'tsyringe';

import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type AbstractEventManager from '../platform/AbstractEventManager';
import type { IEventEmitter } from '../platform/AbstractEventManager';
import type VideoEditor from '../editor/VideoEditor';
import type MusicComposer from '../editor/MusicComposer';
import type { FFMpegInfos, LogParams, ProjectConfig, Section, TemplateDescriptor } from '@/core/types';
import type { TemplateDescriptor as SchemaTemplateDescriptor } from '../schemas/template.schemas';
import type Project from '../core/models/Project';
import type Template from '../core/models/Template';
import type TemplateConcreteBuilder from './TemplateConcreteBuilder';

type DirectorDeps = {
  concreteBuilder: TemplateConcreteBuilder;
  musicComposer: MusicComposer;
  project: Project;
  template: Template;
  logger: AbstractLogger;
  ffmpegAdapter: AbstractFFmpeg;
  filesystemAdapter: AbstractFilesystem;
};

@registry([
  {
    token: 'DirectorDeps',
    useFactory: (c: DependencyContainer): DirectorDeps => ({
      concreteBuilder: c.resolve<TemplateConcreteBuilder>('TemplateConcreteBuilder'),
      musicComposer: c.resolve<MusicComposer>('MusicComposer'),
      project: c.resolve<Project>('project'),
      template: c.resolve<Template>('template'),
      logger: c.resolve<AbstractLogger>('logger'),
      ffmpegAdapter: c.resolve<AbstractFFmpeg>('ffmpegAdapter'),
      filesystemAdapter: c.resolve<AbstractFilesystem>('filesystemAdapter'),
    }),
  },
])
@injectable()
class TemplateDirector {
  private readonly emitter: IEventEmitter;

  private builder: TemplateConcreteBuilder | undefined;
  private stopBuild = false;

  private readonly concreteBuilder: TemplateConcreteBuilder;
  private readonly musicComposer: MusicComposer;
  private readonly project: Project;
  private readonly template: Template;
  private readonly logger: AbstractLogger;
  private readonly ffmpegAdapter: AbstractFFmpeg;
  private readonly filesystemAdapter: AbstractFilesystem;

  constructor(
    @inject('eventManager') private readonly eventManager: AbstractEventManager,
    @inject('VideoEditor') private readonly videoEditor: VideoEditor,
    @inject('DirectorDeps') deps: DirectorDeps
  ) {
    this.concreteBuilder = deps.concreteBuilder;
    this.musicComposer = deps.musicComposer;
    this.project = deps.project;
    this.template = deps.template;
    this.logger = deps.logger;
    this.ffmpegAdapter = deps.ffmpegAdapter;
    this.filesystemAdapter = deps.filesystemAdapter;

    this.emitter = this.eventManager.connect();
    this.emitter.on('task-cancelled', () => (this.stopBuild = true));
    this.videoEditor.emitter = this.emitter;

    this.logger.info('Director class created');
  }

  config = (projectConfig: ProjectConfig, templateDescriptor: TemplateDescriptor): TemplateDirector => {
    this.project.config = projectConfig;
    this.template.descriptor = templateDescriptor as unknown as SchemaTemplateDescriptor;

    this.filesystemAdapter.setBuildDir(this.project.config.buildDir ?? 'build');
    this.filesystemAdapter.setAssetsDir(this.project.config.assetsDir ?? 'assets');

    this.project.applyDefault();

    if (!this.project.config.userVideoPaths) {
      this.logger.info('TemplateDirector: No userVideoPaths provided in config');

      return this;
    }

    this.logger.info(
      `TemplateDirector received userVideoPaths with ${Object.keys(this.project.config.userVideoPaths).length} videos for sections:`,
      { sections: Object.keys(this.project.config.userVideoPaths).join(', ') }
    );

    return this;
  };

  construct = async (): Promise<string | null> => {
    try {
      await this.init();

      const finalPath = await this.compileVideoSegments();

      if (!this.stopBuild) {
        return finalPath;
      }
    } catch (error) {
      this.fireError(error);

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
    const allSections = (this.template.descriptor.sections ?? []) as unknown as Section[];
    const videoSegmentTypes = new Set(['video', 'project_video', 'image_background', 'color_background']);
    const videoSegments = allSections.filter((section) => videoSegmentTypes.has(section.type));

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
    const resolveDuration = async (segment: Section): Promise<number> => {
      if (segment.type === 'project_video') {
        return this.getVideoSectionDuration(segment);
      }

      return segment.options?.duration ?? 0;
    };

    const durations = await Promise.all(segments.map(resolveDuration));
    const durMap = this.project.buildInfos.durations as unknown as Record<string, number>;

    for (const [index, segment] of segments.entries()) {
      const duration = durations[index] ?? 0;
      this.project.buildInfos.totalLength += duration;
      durMap[segment.name] = duration;
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
    const { totalLength } = this.project.buildInfos;
    const durMap = this.project.buildInfos.durations as unknown as Record<string, number>;
    let accumulated = 0;

    await segments.reduce(async (chain, segment) => {
      await chain;

      if (this.stopBuild) {
        return;
      }

      const segmentLength = durMap[segment.name] ?? 0;

      // Forward this segment's fine-grained ffmpeg progress (0..1), interpolated
      // within its share of the total duration. This matches updateProgress's
      // weighting exactly (frac=1 lands on the same value updateProgress emits at
      // the boundary), so the bar climbs continuously with no jumps.
      this.ffmpegAdapter.progressListener = (fraction: number): void => {
        if (totalLength <= 0) {
          return;
        }

        const frac = Math.min(Math.max(fraction, 0), 1);
        this.emitter.emit('compilation-progress', Math.min(1, (accumulated + frac * segmentLength) / totalLength));
      };

      try {
        await this.processSingleVideoSegment(segment);
      } finally {
        this.ffmpegAdapter.progressListener = undefined;
      }

      accumulated += segmentLength;
    }, Promise.resolve());
  };

  processSingleVideoSegment = async (segment: Section): Promise<boolean> => {
    try {
      await this.addToQueue(segment);
      this.updateProgress(segment);
      this.logger.info(`[${segment.name}][Editing] finalized (${Math.round(this.project.progress * 100)}%)`);

      return true;
    } catch (error) {
      this.fireError(error);

      return false;
    }
  };

  updateProgress = (segment: Section): void => {
    const { totalLength } = this.project.buildInfos;
    const durMap = this.project.buildInfos.durations as unknown as Record<string, number>;
    const segmentLength = durMap[segment.name] ?? 0;

    this.project.progress = Math.min(1, this.project.progress + segmentLength / totalLength);
    this.project.buildInfos.currentProgress = this.project.progress;

    this.emitter.emit('compilation-progress', this.project.progress);
  };

  finalizeCompilation = async (segments: Section[]): Promise<string | null> => {
    const concatSegments = this.videoEditor.concat.bind(this.videoEditor);
    const finalPath = await concatSegments();
    await this.videoEditor.finalize(segments);

    return finalPath;
  };

  private readonly resolveUserVideoSource = async (section: Section): Promise<string | undefined> => {
    const userPath = this.project.config.userVideoPaths?.[section.name];

    if (section.type !== 'project_video' || !userPath) {
      return undefined;
    }

    this.logger.info(`[fetchSectionInfos] Using section-specific video for ${section.name}: ${userPath}`);

    try {
      await this.filesystemAdapter.stat(userPath);
      this.logger.info(`[fetchSectionInfos] Verified file exists: ${userPath}`);

      return userPath;
    } catch (error) {
      const logParams: LogParams = error instanceof Error ? { message: error.message, stack: error.stack } : {};
      this.logger.error(`[fetchSectionInfos] Error accessing section-specific video: ${userPath}`, logParams);

      return undefined;
    }
  };

  fetchSectionInfos = async (section: Section): Promise<FFMpegInfos> => {
    this.logger.info(`[fetchSectionInfos] Processing section ${section.name} (${section.type})`);

    if (this.project.config.userVideoPaths) {
      this.logger.info(
        `[fetchSectionInfos] Available userVideoPaths:`,
        Object.keys(this.project.config.userVideoPaths).reduce<Record<string, boolean>>((obj, key) => {
          obj[key] = true;

          return obj;
        }, {})
      );
    }

    const resolvedSource = await this.resolveUserVideoSource(section);
    const source = resolvedSource ?? `${this.filesystemAdapter.getAssetsDir('videos')}/${section.name}.mp4`;

    if (!resolvedSource) {
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
    this.filesystemAdapter.unlink(this.project.buildInfos.fileConcatPath).catch(() => {});
    this.emitter.emit('task-stopped', error);
  };
}

export default TemplateDirector;
