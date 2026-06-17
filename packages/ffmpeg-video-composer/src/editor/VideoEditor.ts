import type { IEventEmitter } from '../platform/AbstractEventManager';
import { inject, injectable } from 'tsyringe';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type Template from '../core/models/Template';
import type Project from '../core/models/Project';
import type { Section } from '@/core/types';
import type MusicComposer from './MusicComposer';
import type AnimationComposer from './AnimationComposer';
import { buildPixFmtArg, buildVideoEncoderArgs } from '@/core/encoding';

/** A boundary transition between two adjacent segments — `type` is an xfade name or `cut`. */
type Transition = { type: string; duration: number };

/** Per-segment probe result the assembly graph is built from. */
type SegmentProbe = { duration: number; hasAudio: boolean };

@injectable()
class VideoEditor {
  public emitter: IEventEmitter | undefined;

  constructor(
    @inject('project') private readonly project: Project,
    @inject('template') private readonly template: Template,
    @inject('MusicComposer') private readonly musicComposer: MusicComposer,
    @inject('AnimationComposer') private readonly animationComposer: AnimationComposer,

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

    // Remux (stream-copy, no re-encode) rather than a raw byte copy so the moov atom moves to the
    // front: segment encoders leave it at the end, which keeps single-section outputs from playing
    // in a browser <video> until fully buffered (black preview). The multi-section concat path
    // already applies +faststart; this gives single-section templates the same treatment.
    const remuxed = await this.tryFaststartRemux(sourceFile, finalOutputPath);

    if (remuxed) {
      this.logger.info(`[Concat][Command] Remuxed single file (+faststart) to ${finalOutputPath}`);

      return finalOutputPath;
    }

    // Remux unavailable/failed (e.g. an unexpected container) — fall back to a byte copy so the
    // render still produces a playable file rather than erroring out.
    await this.filesystemAdapter.copy(sourceFile, finalOutputPath);
    this.logger.info(`[Concat][Command] Copied single file to ${finalOutputPath}`);

    return finalOutputPath;
  }

  // Returns true on a successful faststart remux, false on any failure. Adapters differ: the Node
  // adapter throws on a non-zero exit, the WASM/native adapters return `{ rc: 1 }` — handle both.
  private async tryFaststartRemux(sourceFile: string, finalOutputPath: string): Promise<boolean> {
    try {
      const result = await this.ffmpegAdapter.execute(
        ` -y -i ${sourceFile} -c copy -movflags +faststart ${finalOutputPath} `
      );

      return result.rc !== 1;
    } catch {
      return false;
    }
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

  /**
   * Assembles the final video in a single re-encode pass using xfade (video) + acrossfade (audio)
   * when one or more boundaries carry a non-cut transition. Unlike concat() this never stream-copies:
   * the whole timeline is re-encoded so the cross-dissolves can be rendered. Designed to be called by
   * TemplateDirector with the per-boundary transition list (`transitions.length === segmentFiles.length - 1`).
   *
   * Durations are PROBED (never declared): speed/setpts sections, `-shortest` and fps rounding make the
   * authored durations lie, and an off-by-a-frame offset desyncs every later boundary.
   *
   * No fallback to concat — by design. Any adapter failure propagates as a compilation error.
   */
  assembleWithTransitions = async (segmentFiles: string[], transitions: Transition[]): Promise<string> => {
    try {
      if (segmentFiles.length < 2) {
        throw new Error(`[Transitions] assembleWithTransitions needs at least 2 segments, got ${segmentFiles.length}`);
      }

      if (transitions.length !== segmentFiles.length - 1) {
        throw new Error(
          `[Transitions] expected ${segmentFiles.length - 1} transitions for ${segmentFiles.length} segments, got ${transitions.length}`
        );
      }

      const buildDir = this.filesystemAdapter.getBuildDir() ?? 'build';
      const finalOutputPath = `${buildDir}/output.mp4`;
      this.project.finalVideo = finalOutputPath;

      const probes = await this.probeSegments(segmentFiles);
      const command = this.buildTransitionsCommand(segmentFiles, transitions, probes, finalOutputPath);

      this.logger.debug(`[Transitions][Command] ffmpeg ${command}`);
      const result = await this.ffmpegAdapter.execute(command);
      this.logger.info(`[Transitions] ffmpeg process exited with rc ${result.rc}`);

      if (result.rc === 1) {
        this.project.errors.push('transitions');

        throw new Error('[Transitions] Errors on transition assembly');
      }

      return finalOutputPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Transitions] Error: ${message}`);

      throw error;
    }
  };

  private async probeSegments(segmentFiles: string[]): Promise<SegmentProbe[]> {
    const infos = await Promise.all(
      segmentFiles.map(async (file) => {
        try {
          return await this.ffmpegAdapter.getInfos(file);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';

          throw new Error(`[Transitions] could not probe segment ${file}: ${message}`);
        }
      })
    );

    return infos.map((info, k) => {
      if (!info.duration) {
        throw new Error(`[Transitions] could not probe duration of segment ${segmentFiles[k]}`);
      }

      return { duration: info.duration, hasAudio: info.audioCodec !== null };
    });
  }

  /**
   * Builds the full ffmpeg command: one `-i` per segment, optional extra `-f lavfi -i aevalsrc=…`
   * inputs that synthesize a silent audio leg for video-only segments (so acrossfade always has two
   * audio inputs), then the xfade/acrossfade filtergraph and the re-encode output args.
   */
  private buildTransitionsCommand(
    segmentFiles: string[],
    transitions: Transition[],
    probes: SegmentProbe[],
    finalOutputPath: string
  ): string {
    const sampleRate = this.project.config.audioConfig?.sampleRate ?? 48000;
    const inputs = segmentFiles.map((file) => ` -i ${file} `).join('');

    // Each silent segment gets one extra lavfi input appended after the n segment inputs. Track which
    // input index carries the audio leg for every segment (its own `[k:a]`, or the synthesized source).
    const silentInputs: string[] = [];
    const audioInputIndex = probes.map((probe, k) => {
      if (probe.hasAudio) {
        return k;
      }

      const index = segmentFiles.length + silentInputs.length;
      silentInputs.push(` -f lavfi -i aevalsrc=0:d=${probe.duration}:s=${sampleRate} `);

      return index;
    });

    const offsets = this.computeOffsets(probes, transitions);
    const normalizeGraph = this.buildNormalizeGraph(segmentFiles.length);
    const videoGraph = this.buildVideoGraph(transitions, offsets);
    const audioGraph = this.buildAudioGraph(transitions, audioInputIndex);
    const filterComplex = `${normalizeGraph};${videoGraph};${audioGraph}`;

    const encoderArgs = buildVideoEncoderArgs(this.project.config);
    const pixFmtArg = buildPixFmtArg(this.project.config);

    return (
      ' -y ' +
      inputs +
      silentInputs.join('') +
      ` -filter_complex "${filterComplex}" ` +
      ` -map "[vout]" -map "[aout]" -r 30 ${encoderArgs} ${pixFmtArg} -c:a aac -ac 2 -movflags +faststart ${finalOutputPath} `
    );
  }

  /**
   * xfade requires all inputs to share one resolution/SAR, and segments can disagree
   * (forceAspectRatio sections, mixed sources). Scale-and-pad every segment to the project
   * scale before the xfade chain. `videoConfig.scale` is already orientation-swapped by the
   * segment pass, so it is the final output size.
   */
  private buildNormalizeGraph(segmentCount: number): string {
    const scale = this.project.config.videoConfig?.scale ?? '1280:720';
    const links: string[] = [];

    for (let k = 0; k < segmentCount; k++) {
      links.push(
        `[${k}:v]scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2,setsar=1[vs${k}]`
      );
    }

    return links.join(';');
  }

  /**
   * offset_k = (Σ_{i≤k} d_i) − (Σ_{i≤k} tr_i) for the k-th boundary (1-indexed over boundaries).
   * The cumulative subtraction of prior transition durations keeps every clip starting where the
   * previous cross-dissolve ends, so later boundaries don't drift.
   */
  private computeOffsets(probes: SegmentProbe[], transitions: Transition[]): number[] {
    const offsets: number[] = [];
    let durationSum = 0;
    let transitionSum = 0;

    for (let k = 0; k < transitions.length; k++) {
      durationSum += probes[k].duration;
      transitionSum += this.effectiveDuration(transitions[k]);
      offsets.push(this.round(durationSum - transitionSum));
    }

    return offsets;
  }

  // A `cut` boundary is rendered as a near-zero fade so the graph stays uniform (one xfade per boundary).
  private effectiveDuration(transition: Transition): number {
    return transition.type === 'cut' ? 0.001 : transition.duration;
  }

  private transitionName(transition: Transition): string {
    return transition.type === 'cut' ? 'fade' : transition.type;
  }

  // FFmpeg accepts decimals; trim float noise (4.499999) to keep commands clean and assertable.
  private round(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  private buildVideoGraph(transitions: Transition[], offsets: number[]): string {
    const links: string[] = [];

    for (let k = 0; k < transitions.length; k++) {
      const left = k === 0 ? '[vs0]' : `[v${k - 1}]`;
      const right = `[vs${k + 1}]`;
      const out = k === transitions.length - 1 ? '[vout]' : `[v${k}]`;
      const name = this.transitionName(transitions[k]);
      const duration = this.effectiveDuration(transitions[k]);

      links.push(`${left}${right}xfade=transition=${name}:duration=${duration}:offset=${offsets[k]}${out}`);
    }

    return links.join(';');
  }

  private buildAudioGraph(transitions: Transition[], audioInputIndex: number[]): string {
    const links: string[] = [];

    for (let k = 0; k < transitions.length; k++) {
      const left = k === 0 ? `[${audioInputIndex[0]}:a]` : `[a${k - 1}]`;
      const right = `[${audioInputIndex[k + 1]}:a]`;
      const out = k === transitions.length - 1 ? '[aout]' : `[a${k}]`;

      links.push(`${left}${right}acrossfade=d=${this.effectiveDuration(transitions[k])}:c1=tri:c2=tri${out}`);
    }

    return links.join(';');
  }

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

  // Whole-video animation overlays (global.animations) are composited over the joined video first,
  // re-encoding it once; music (below) then stream-copies that overlaid video. Runs only when the
  // template declares overlays and a final video exists.
  private async overlayAnimations(): Promise<void> {
    if (this.template.descriptor.global?.animations?.length && this.project.finalVideo) {
      await this.animationComposer.appendAnimations(this.project.finalVideo);
    }
  }

  // Music is mixed only when the template enables it AND a track actually resolved (buildInfos.
  // musicPath is empty when none is selected). Without a track there's nothing to loop or append —
  // the concat output is already the final video. Probing an empty path would otherwise fail.
  private async mixMusic(segments: Section[]): Promise<void> {
    if (
      !this.template.descriptor.global?.musicEnabled ||
      !this.project.buildInfos.musicPath ||
      !this.project.finalVideo
    ) {
      return;
    }

    await this.musicComposer.loopMusic();
    await this.musicComposer.appendMusic(segments, this.project.finalVideo);
  }

  private async emitFinalize(): Promise<void> {
    if (this.project.errors.length > 0) {
      return;
    }

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

  finalize = async (segments: Section[]): Promise<void> => {
    try {
      await this.overlayAnimations();
      await this.mixMusic(segments);
      await this.emitFinalize();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Finalize] Error: ${message}`);
    }
  };
}

export default VideoEditor;
