import { inject, injectable, registry, type DependencyContainer } from 'tsyringe';

import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type AbstractEventManager from '../platform/AbstractEventManager';
import type { IEventEmitter } from '../platform/AbstractEventManager';
import type VideoEditor from '../editor/VideoEditor';
import type MusicComposer from '../editor/MusicComposer';
import type { FFMpegInfos, LogParams, ProjectConfig, Section, TemplateDescriptor } from '@/core/types';
import { DEFAULT_TRANSITION_DURATION } from '../schemas/effects.schemas';
import { assertSafeArgToken, assertSafeSegmentName } from '../core/argGuard';
import type { TemplateDescriptor as SchemaTemplateDescriptor } from '../schemas/template.schemas';
import { expandPartialsSafe } from '@leclap/creative-kit/partials';
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

  config = (projectConfig: ProjectConfig, templateDescriptor: TemplateDescriptor): this => {
    this.project.config = projectConfig;
    // Deep-clone the descriptor: section.filters are mutated in place during builds (sugar/scale prepend
    // preset filters), so compiling the same descriptor twice would double-apply them (Ken Burns twice,
    // contrast squared). JSON round-trip matches the repo's deep-clone (Hermes/WASM-safe plain JSON).
    const clonedDescriptor = structuredClone(templateDescriptor);
    // Expand `{ type:'partial', ref }` sections into real sections here, the single point where the
    // descriptor used for compilation is set. Callers pass the raw descriptor (Node `compile` never
    // validates; the browser path validates into the template but this assignment would overwrite it),
    // so without this every partial — logo bumper, flash-card — is dropped downstream by the
    // rendering-type filter. Idempotent: re-expanding an already-expanded descriptor is a no-op.
    const expansion = expandPartialsSafe(clonedDescriptor);

    if (!expansion.ok) {
      // Unknown ref: keep the clone (the stray partial is skipped by compileVideoSegments, as before).
      this.logger.warn(`[Director] partial expansion failed: ${expansion.error.message}`);
    }

    this.template.descriptor = (expansion.ok ? expansion.data : clonedDescriptor) as SchemaTemplateDescriptor;

    this.filesystemAdapter.setBuildDir(this.project.config.buildDir ?? 'build');
    this.filesystemAdapter.setAssetsDir(this.project.config.assetsDir ?? 'assets');

    this.project.applyDefault();
    this.applyOrientationToScale();

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

  // Resolve the output orientation ONCE, here — the single point where the descriptor and the
  // project config meet. A portrait template swaps the configured W:H so the recorded clip, the cards,
  // and the final normalize all render to the same vertical scale. Replaces the old per-SegmentBuilder
  // swap, which mutated the shared config per segment and alternated portrait/landscape across them.
  private readonly applyOrientationToScale = (): void => {
    if (this.template.descriptor.global?.orientation !== 'portrait') return;

    const videoConfig = this.project.config.videoConfig;
    const parts = videoConfig?.scale?.split(':');
    const [width, height] = [parts?.[0], parts?.[1]];

    if (width === undefined || height === undefined || !videoConfig) return;

    this.project.config.videoConfig = { ...videoConfig, scale: `${height}:${width}` };
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

    this.buildTransitions(videoSegments);
    await this.calculateTotalLength(videoSegments);

    this.logger.info(`[TemplateDirection] Length: ${this.project.buildInfos.totalLength}`);
    this.project.buildInfos.totalSegments = videoSegments.length;

    await this.processVideoSegments(videoSegments);

    if (!this.stopBuild) {
      return await this.finalizeCompilation(videoSegments);
    }

    return null;
  };

  /**
   * Builds the per-boundary transition list for the N rendering sections (N-1 boundaries, in order).
   * Each boundary takes the transition of the EARLIER section (`sections[i].transition`) or the global
   * default; a boundary is only a non-cut transition when one is declared (section or global). Cut
   * boundaries keep type 'cut' (duration 0 in timeline math). Stored on buildInfos.transitions —
   * consumed by MusicComposer (xfade-aware windows) and the final-assembly path selection.
   */
  private readonly buildTransitions = (segments: Section[]): void => {
    const globalTransition = this.template.descriptor.global?.transition;
    const transitions = this.project.buildInfos.transitions;
    transitions.length = 0;

    for (let i = 0; i < segments.length - 1; i++) {
      const declared = segments[i].transition ?? globalTransition;

      if (!declared || declared.type === 'cut') {
        transitions.push({ type: 'cut', duration: 0 });

        continue;
      }

      const duration = declared.duration ?? globalTransition?.duration ?? DEFAULT_TRANSITION_DURATION;
      transitions.push({ type: declared.type, duration });
    }
  };

  calculateTotalLength = async (segments: Section[]): Promise<void> => {
    const resolveDuration = async (segment: Section): Promise<number> => {
      if (segment.type === 'project_video') {
        return this.getVideoSectionDuration(segment);
      }

      return segment.options?.duration ?? 0;
    };

    const durations = await Promise.all(segments.map(resolveDuration));
    const durMap = this.project.buildInfos.durations;

    for (const [index, segment] of segments.entries()) {
      const duration = durations[index] ?? 0;
      this.project.buildInfos.totalLength += duration;
      durMap[segment.name] = duration;
    }

    // Each non-cut boundary cross-dissolves, overlapping its two clips and shortening the rendered
    // timeline by the transition duration. Cut boundaries subtract 0.
    const transitionTotal = this.project.buildInfos.transitions.reduce((sum, t) => sum + t.duration, 0);
    this.project.buildInfos.totalLength -= transitionTotal;
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
    const durMap = this.project.buildInfos.durations;
    let accumulated = 0;

    await segments.reduce(async (chain, segment) => {
      await chain;

      if (this.stopBuild) {
        return;
      }

      const segmentLength = durMap[segment.name] ?? 0;

      // Forward this segment's fine-grained ffmpeg progress (0..1), interpolated within its share of
      // the total duration. Matches updateProgress's weighting exactly (frac=1 lands on the same value
      // updateProgress emits at the boundary), so the bar climbs continuously with no jumps.
      this.ffmpegAdapter.progressListener = (fraction: number): void => {
        if (totalLength <= 0) {
          return;
        }

        const frac = Math.min(Math.max(fraction, 0), 1);
        this.emitter.emit('compilation-progress', Math.min(1, (accumulated + frac * segmentLength) / totalLength));
      };
      // Adapters that read raw elapsed time from FFmpeg (the on-device CLI's `-progress`) normalise
      // against this to produce the 0..1 fraction above.
      this.ffmpegAdapter.expectedDurationSeconds = segmentLength;

      try {
        await this.processSingleVideoSegment(segment);
      } finally {
        this.ffmpegAdapter.progressListener = undefined;
        this.ffmpegAdapter.expectedDurationSeconds = undefined;
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
    const durMap = this.project.buildInfos.durations;
    const segmentLength = durMap[segment.name] ?? 0;

    this.project.progress = Math.min(1, this.project.progress + segmentLength / totalLength);
    this.project.buildInfos.currentProgress = this.project.progress;

    this.emitter.emit('compilation-progress', this.project.progress);
  };

  finalizeCompilation = async (segments: Section[]): Promise<string | null> => {
    const transitions = this.project.buildInfos.transitions;
    const hasTransition = transitions.some((transition) => transition.type !== 'cut');

    const finalPath = await this.assembleFinalVideo(hasTransition, transitions);

    // No-music path: normalize the assembled output in place before finalize() fires the `finalize`
    // event and runs project.clean() (which resets finalVideo). No-op unless global.audio.normalize
    // is set. When music IS enabled, normalization is handled inside the music mix instead.
    if (!this.template.descriptor.global?.musicEnabled) {
      await this.musicComposer.normalizeAudio(this.project.finalVideo);
    }

    // Music windows already account for the xfade-shortened timeline (buildInfos.transitions), so the
    // existing music flow (loopMusic + appendMusic) runs unchanged inside finalize after assembly.
    await this.videoEditor.finalize(segments);

    return finalPath;
  };

  private readonly assembleFinalVideo = async (
    hasTransition: boolean,
    transitions: Array<{ type: string; duration: number }>
  ): Promise<string> => {
    if (!hasTransition) {
      const concatSegments = this.videoEditor.concat.bind(this.videoEditor);

      return concatSegments();
    }

    // segmentFiles are the per-section rendered outputs, in order — the same files appended to the
    // concat list (collected in append()). The transitions arg includes cut entries (rendered as
    // 1ms fades); length must equal segmentFiles.length - 1.
    const segmentFiles = this.project.buildInfos.videoInputs;

    return this.videoEditor.assembleWithTransitions(segmentFiles, transitions);
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
        Object.fromEntries(Object.keys(this.project.config.userVideoPaths).map((key) => [key, true]))
      );
    }

    const resolvedSource = await this.resolveUserVideoSource(section);
    // Guard the section name in the assets-dir fallback (prevents `../` traversal into a probed file)
    // and reject whitespace/NUL in the probed source token, mirroring the `-i` source guard.
    const source = assertSafeArgToken(
      resolvedSource ?? `${this.filesystemAdapter.getAssetsDir('videos')}/${assertSafeSegmentName(section.name)}.mp4`,
      'source'
    );

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
    const file = `${this.filesystemAdapter.getBuildDir()}/${assertSafeSegmentName(section.name)}_output.mp4`;
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
