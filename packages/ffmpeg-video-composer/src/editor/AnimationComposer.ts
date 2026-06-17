import { inject, injectable, registry, type DependencyContainer } from 'tsyringe';
import type { GlobalAnimation } from '@/core/types';
import { buildPixFmtArg, buildVideoEncoderArgs } from '@/core/encoding';
import { buildSingleFileAnimationSource, buildAnimationLegFilters } from './inputSources';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type Template from '../core/models/Template';
import type Project from '../core/models/Project';
import type VariableManager from './managers/VariableManager';

type StagedAnimation = { path: string; anim: GlobalAnimation };

type AnimationComposerDeps = {
  project: Project;
  template: Template;
  logger: AbstractLogger;
  ffmpegAdapter: AbstractFFmpeg;
  filesystemAdapter: AbstractFilesystem;
  variableManager: VariableManager;
};

/**
 * Composites the template's whole-video animation overlays (global.animations) over the FINAL joined
 * video, in a single post-concat pass — the visual analog of MusicComposer, which mixes music over the
 * same joined output. Because it runs once on the concatenated `output.mp4` (not per section), the
 * overlays span every section continuously. Called from VideoEditor.finalize BEFORE music, so music's
 * stream-copy of the video carries the overlaid frames.
 */
@registry([
  {
    token: 'AnimationComposerDeps',
    useFactory: (c: DependencyContainer): AnimationComposerDeps => ({
      project: c.resolve<Project>('project'),
      template: c.resolve<Template>('template'),
      logger: c.resolve<AbstractLogger>('logger'),
      ffmpegAdapter: c.resolve<AbstractFFmpeg>('ffmpegAdapter'),
      filesystemAdapter: c.resolve<AbstractFilesystem>('filesystemAdapter'),
      variableManager: c.resolve<VariableManager>('VariableManager'),
    }),
  },
])
@injectable()
class AnimationComposer {
  private readonly project: Project;
  private readonly template: Template;
  private readonly logger: AbstractLogger;
  private readonly ffmpegAdapter: AbstractFFmpeg;
  private readonly filesystemAdapter: AbstractFilesystem;
  private readonly variableManager: VariableManager;

  constructor(@inject('AnimationComposerDeps') deps: AnimationComposerDeps) {
    this.project = deps.project;
    this.template = deps.template;
    this.logger = deps.logger;
    this.ffmpegAdapter = deps.ffmpegAdapter;
    this.filesystemAdapter = deps.filesystemAdapter;
    this.variableManager = deps.variableManager;
  }

  private animations(): GlobalAnimation[] {
    return this.template.descriptor.global?.animations ?? [];
  }

  /**
   * Resolve each whole-video animation to a local file path — offline-first via resolveLocalAsset
   * (a copy staged under assetsDir), else download. Mirrors AssetManager.fetchMedia / MusicComposer,
   * so `{{ var }}` urls and bundled `/assets/animations/x.apng` paths both work cross-platform.
   */
  loadAnimations = async (): Promise<StagedAnimation[]> => {
    const animations = this.animations();

    if (animations.length === 0) {
      return [];
    }

    const buildAssetsDir = await this.filesystemAdapter.getBuildPath('assets');

    return Promise.all(
      animations.map(async (anim) => {
        const url = this.variableManager.mapVariables(anim.url);
        const path = await this.stageAnimation(url, buildAssetsDir);

        return { path, anim };
      })
    );
  };

  private async stageAnimation(url: string, buildAssetsDir: string): Promise<string> {
    const local = await this.filesystemAdapter.resolveLocalAsset(url);

    if (local) {
      this.logger.info(`[Animation] local asset ${url}`);

      return local;
    }

    this.logger.info(`[Animation] fetching ${url}`);
    const fetched = await this.filesystemAdapter.fetch(url);
    const name = url.split('/').at(-1) ?? 'animation';
    const target = `${buildAssetsDir}/${name}`;
    await this.filesystemAdapter.move(fetched, target);

    return target;
  }

  /**
   * Overlay the staged animations over `finalVideo`, in place (move aside → single ffmpeg pass →
   * cleanup), the same shape MusicComposer.appendMusic uses. Video is re-encoded (overlay can't
   * stream-copy); the joined video's audio is copied through when present.
   */
  appendAnimations = async (finalVideo: string): Promise<void> => {
    const staged = await this.loadAnimations();

    if (staged.length === 0) {
      return;
    }

    const time = Date.now();
    const temp = `${this.filesystemAdapter.getTempDir()}/tmp_anim_${time}.mp4`;
    await this.filesystemAdapter.move(finalVideo, temp);

    // The joined output may have no audio (e.g. a video-only upload); probe so the map below
    // doesn't reference a missing `[0:a]`. The probed duration is the safety ceiling for finite
    // loop-counts so an over-long looped overlay can't lengthen the output past the video.
    const infos = await this.ffmpegAdapter.getInfos(temp);
    const hasAudio = infos.audioCodec !== null;
    const baseDuration = infos.duration ?? undefined;

    const command = this.buildCommand(temp, staged, finalVideo, hasAudio, baseDuration);
    this.logger.debug(`[Animation][Command] ffmpeg ${command}`);

    const result = await this.ffmpegAdapter.execute(command);
    this.logger.info(`[Animation] ffmpeg process exited with rc ${result.rc}`);

    if (result.rc === 1) {
      this.project.errors.push('animations');

      throw new Error('Error on animation overlay');
    }

    await this.filesystemAdapter.unlink(temp);
  };

  private buildCommand(
    temp: string,
    staged: StagedAnimation[],
    finalVideo: string,
    hasAudio: boolean,
    baseDuration?: number
  ): string {
    const sources = staged
      .map(({ anim, path }) =>
        buildSingleFileAnimationSource({ url: anim.url, options: anim }, path, { maxDuration: baseDuration })
      )
      .join(' ');

    const filterComplex = this.buildFilterComplex(staged);
    const encoderArgs = buildVideoEncoderArgs(this.project.config);
    const pixFmtArg = buildPixFmtArg(this.project.config);
    const audioMap = hasAudio ? ' -map 0:a -c:a copy ' : ' ';

    return (
      ` -y -i ${temp} ${sources} ` +
      ` -filter_complex "${filterComplex}" ` +
      ` -map "[vout]"${audioMap}${encoderArgs} ${pixFmtArg} -movflags +faststart ${finalVideo} `
    );
  }

  /**
   * Per animation k (input index k+1): scale/fade its leg, then chain `overlay` over the running base
   * (`[0:v]` first, the prior overlay output after). `shortest=1` on a looping overlay bounds the
   * output to the video; `eof_action` freezes (persistent) or shows the video through (default) once a
   * non-looping overlay ends.
   */
  private buildFilterComplex(staged: StagedAnimation[]): string {
    const legs: string[] = [];
    const overlays: string[] = [];
    let base = '[0:v]';

    for (const [k, { anim }] of staged.entries()) {
      const inputIndex = k + 1;
      const legFilters = buildAnimationLegFilters({
        scale: anim.scale,
        rotation: anim.rotation,
        opacity: anim.opacity,
      });
      let legRef = `[${inputIndex}:v]`;

      if (legFilters.length > 0) {
        const pad = `[anim${k}]`;
        legs.push(`[${inputIndex}:v]${legFilters.join(',')}${pad}`);
        legRef = pad;
      }

      const position = anim.position ?? '0:0';
      const eofAction = anim.persistent ? 'repeat' : 'pass';
      // shortest only bounds the legacy infinite `loop:true` case; duration/loops sources are already
      // finite (via -t / -stream_loop N), so the output is bounded by the base video without it.
      const infiniteLoop = anim.loop === true && anim.loops === undefined && anim.duration === undefined;
      const shortest = infiniteLoop ? ':shortest=1' : '';
      const out = k === staged.length - 1 ? '[vout]' : `[v${k}]`;

      overlays.push(`${base}${legRef}overlay=${position}:eof_action=${eofAction}${shortest}${out}`);
      base = `[v${k}]`;
    }

    return [...legs, ...overlays].join(';');
  }
}

export default AnimationComposer;
