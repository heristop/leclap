import { container, inject, injectable } from 'tsyringe';
import type { MusicConfig, Section } from '@/core/types';
import { DEFAULT_TRANSITION_DURATION } from '../schemas/effects.schemas';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type AbstractMusic from '../platform/ffmpeg/AbstractMusic';
import type Template from '../core/models/Template';
import type Project from '../core/models/Project';
import { resolveVideoInput, type VideoSource } from './utils/video-input';
import { resolveMusicFade } from './utils/music-fade';
import { finalizeLeg, type PendingLeg } from './utils/music-leg';
import { musicAssetUrl } from '@/core/asset-source';

type AppendMusicOptions = {
  videoInputArgs: string;
  segments: Section[];
  finalVideo: string;
  audioVolumeLevel: number;
  reduceNoiseConfig: string;
  sampleRate: number | undefined;
  hasSegmentAudio: boolean;
};

@injectable()
class MusicComposer {
  private buildAssetsDir = '';
  private musicAssetsDir = '';

  // Memoized result of resolveMusicFade — computed once per build since it only depends on
  // instance-constant inputs (the descriptor's configured musicFade/transition, and the section list).
  private resolvedMusicFade: number | null = null;

  // The most recently seen section whose true video-timeline advance is still unknown (it depends on
  // the transition into the NEXT section — see prepareMusicTrack/finalizeLeg). null once flushed.
  private pendingLeg: PendingLeg | null = null;

  private readonly project: Project;
  private readonly template: Template;
  private readonly logger: AbstractLogger;
  private readonly ffmpegAdapter: AbstractFFmpeg;
  private readonly filesystemAdapter: AbstractFilesystem;
  private readonly musicAdapter: AbstractMusic;

  constructor(
    @inject('project') project: Project,
    @inject('template') template: Template,
    @inject('logger') logger: AbstractLogger,
    @inject('ffmpegAdapter') ffmpegAdapter: AbstractFFmpeg,
    @inject('filesystemAdapter') filesystemAdapter: AbstractFilesystem
  ) {
    this.project = project;
    this.template = template;
    this.logger = logger;
    this.ffmpegAdapter = ffmpegAdapter;
    this.filesystemAdapter = filesystemAdapter;
    this.musicAdapter = container.resolve<AbstractMusic>('musicAdapter');
  }

  // Resolve the active music config — from project config, else the template's global.music. null = none.
  private ensureMusicConfig(): MusicConfig | null {
    if (this.project.config.music) {
      return this.project.config.music;
    }

    const fromTemplate = this.template.descriptor.global?.music;

    if (fromTemplate) {
      this.project.config.music = fromTemplate;

      return fromTemplate;
    }

    return null;
  }

  /**
   * Load background music track from cache or download
   */
  loadMusic = async (): Promise<void> => {
    this.buildAssetsDir = await this.filesystemAdapter.getBuildPath('assets');
    this.musicAssetsDir = await this.filesystemAdapter.getAssetsPath('musics');

    const music = this.ensureMusicConfig();

    if (!music) {
      return;
    }

    const musicFormattedName = this.formatMusicName(music);

    const cachedPath = await this.resolveCachedMusic(music, musicFormattedName);

    if (cachedPath) {
      this.logger.info(`[Music] Loaded from cache ${cachedPath}`);
      this.project.buildInfos.musicPath = cachedPath;

      return;
    }

    this.project.buildInfos.musicPath = await this.resolveBundledOrDownloadedMusic(music, musicFormattedName);
  };

  // Prefer a track shipped with the package (resolved locally on Node) over a network download —
  // mirrors bundled-font resolution, so `global.music: { name }` works offline on Node/server/MCP.
  private async resolveBundledOrDownloadedMusic(music: MusicConfig, formattedName: string): Promise<string> {
    const bundled = await this.filesystemAdapter.resolveBundledMusic(`${formattedName}.mp3`);

    if (bundled) {
      this.logger.info(`[Music] bundled ${bundled}`);

      return bundled;
    }

    // A catalog track is fetched by name from the asset source (GitHub by default, see asset-source.ts)
    // rather than bundling the ~104 MB library. Only an ABSOLUTE http(s) `url` is a real download
    // source; a relative `url` (e.g. `musics/point-being.mp3`, the catalog templates' assets-dir hint)
    // is not fetchable — treat it as a name and resolve via the asset source, or the Node adapter would
    // `realpath`-crash trying to read it as a local file.
    const isRemoteUrl = /^https?:\/\//i.test(music.url ?? '');
    const url = isRemoteUrl ? (music.url as string) : musicAssetUrl(`${formattedName}.mp3`);
    this.logger.info(`[Music] Fetching ${url}`);
    const destination = `${this.buildAssetsDir}/${formattedName}.mp3`;
    await this.downloadAndSaveMusic(url, destination);

    return destination;
  }

  // Resolve a bundled music file from the local assets dir. Tries the configured (display) name first,
  // then the URL's own basename — the bundled library names files after the URL, not the display name,
  // so a template like { name: 'popopop', url: '.../pop.mp3' } still resolves to the local pop.mp3
  // instead of forcing a network download.
  private async resolveCachedMusic(music: MusicConfig, formattedName: string): Promise<string | null> {
    const byName = `${this.musicAssetsDir}/${formattedName}.mp3`;

    if (await this.checkMusicExists(byName)) {
      return byName;
    }

    const urlName = music.url ? this.removeExtension(music.url.split('/').at(-1) ?? '') : '';

    if (urlName && urlName !== formattedName) {
      const byUrl = `${this.musicAssetsDir}/${urlName}.mp3`;

      if (await this.checkMusicExists(byUrl)) {
        return byUrl;
      }
    }

    return null;
  }

  private async downloadAndSaveMusic(url: string, destination: string): Promise<void> {
    const musicPath = await this.downloadMusic(url);
    await this.filesystemAdapter.move(musicPath, destination);
    this.logger.info(`[Music] Fetched ${destination}`);
  }

  private async downloadMusic(url: string): Promise<string> {
    return await this.filesystemAdapter.fetch(url);
  }

  /**
   * Format music name from config or extract from URL
   */
  private formatMusicName(music: MusicConfig): string {
    if (music.name) {
      return this.removeExtension(music.name);
    }

    const urlParts = music.url?.split('/') ?? [];
    const lastSegment = urlParts.slice(-1);
    const fileName = lastSegment[0] ?? '';

    return this.removeExtension(fileName);
  }

  private removeExtension(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '');
  }

  private async checkMusicExists(filePath: string): Promise<boolean> {
    return await this.filesystemAdapter.stat(filePath);
  }

  // The RENDERED length of a section, matching what actually ends up on the video timeline (and
  // what the xfade assembly's own probe of the rendered file sees) — NOT necessarily the declared
  // length. `ProjectVideoSegment` trims a `project_video` clip with `-t options.duration -shortest`,
  // so the true rendered length is `min(declared, probed-clip-length)`. calculateTotalLength stores
  // the RAW probed clip length (uncapped by the declared duration) in buildInfos.durations for a
  // project_video; for every other section type it stores the declared duration verbatim (there's no
  // separate source clip to trim against), so `declared` and `probed` already agree there.
  private renderedSectionDuration(section: Section): number {
    const declared = section.options?.duration ?? 0;
    const probed = this.project.buildInfos.durations[section.name] ?? 0;

    if (declared > 0 && probed > 0) {
      return Math.min(declared, probed);
    }

    return probed || declared;
  }

  // Per-section override wins; otherwise fall back to the template-wide music level (the builder's
  // music slider), then the engine default. 0 = silent music.
  private resolveMusicVolumeLevel(section: Section): number {
    return section.options?.musicVolume ?? this.template.descriptor.global?.audio?.musicVolume ?? 0.5;
  }

  // Memoized ONCE per build (see ./utils/music-fade): decouples the music leg-to-leg blend from
  // transitionDuration, which afade in/out still use as-is (a video-synced fade to/from silence at
  // the start/end, not a leg blend, so it has no reason to track this).
  private resolveTransitionAndFade(): { transitionDuration: number; musicFade: number } {
    const transitionDuration = this.template.descriptor.global?.transition?.duration ?? DEFAULT_TRANSITION_DURATION;
    const durations = this.project.buildInfos.durations;
    // durations is fully populated by calculateTotalLength before any section reaches
    // prepareMusicTrack, so it's stable for the memoized lifetime of resolvedMusicFade.
    const musicFade = (this.resolvedMusicFade ??= resolveMusicFade(this.template.descriptor, transitionDuration, durations));

    return { transitionDuration, musicFade };
  }

  /**
   * Configure audio filters for video segment.
   *
   * Each non-cut boundary overlaps its two VIDEO clips (xfade), shortening the rendered video
   * timeline by that boundary's effective (capped) transition duration. The music track must track
   * that SAME compressed timeline, or its volume envelope (e.g. a flash-card's louder `musicVolume`)
   * drifts later and later relative to the section it's meant to cover — this is the bug this method
   * fixes (see ./utils/music-leg for the arithmetic).
   *
   * A leg's own advance depends on the transition into the NEXT section, so it can't be finalized
   * (pushed to musicFilters) until that next section's duration is known. Each call therefore
   * finalizes the PREVIOUS section (now that this section's duration closes the gap) before storing
   * itself as the new pending leg — except the last section, which has no outgoing boundary to wait
   * for and finalizes immediately. `musicFilters` is joined into one `-filter_complex` string later
   * (in buildFilterComplex), so pushing leg N's own filter one call after leg N started doesn't
   * matter — ffmpeg's filtergraph parser links labels regardless of statement order.
   */
  prepareMusicTrack = (section: Section): void => {
    const musicVolumeLevel = this.resolveMusicVolumeLevel(section);
    const { transitionDuration, musicFade } = this.resolveTransitionAndFade();

    const duration = this.renderedSectionDuration(section);

    const sectionIncrement = this.project.buildInfos.currentIncrement + 1;
    const isLastSection = sectionIncrement === this.project.buildInfos.totalSegments;
    const mapName = isLastSection ? 'lastsection' : `section${sectionIncrement}`;

    this.project.buildInfos.currentIncrement = sectionIncrement;

    // This section's duration is exactly what the PREVIOUS (pending) leg was waiting for — finalize
    // it now, which also advances currentLength to this leg's correct start.
    if (this.pendingLeg) {
      this.pushFinalizedLeg(this.pendingLeg, duration, transitionDuration, musicFade);
      this.pendingLeg = null;
    }

    const leg: PendingLeg = {
      ss: this.project.buildInfos.currentLength,
      duration,
      sectionIncrement,
      musicVolumeLevel,
      mapName,
    };

    if (isLastSection) {
      // No outgoing boundary to wait for — finalize immediately (advance = its own full duration).
      this.pushFinalizedLeg(leg, null, transitionDuration, musicFade);

      return;
    }

    this.pendingLeg = leg;
  };

  // Resolves the leg's filter + crossfade via ./utils/music-leg (pure), then applies its side
  // effects: pushes both filter strings and advances currentLength to the leg's true video-timeline
  // advance.
  private pushFinalizedLeg(
    leg: PendingLeg,
    nextDuration: number | null,
    transitionDuration: number,
    musicFade: number
  ): void {
    const transition = this.project.buildInfos.transitions[leg.sectionIncrement - 1];
    const resolved = finalizeLeg(leg, nextDuration, transition, transitionDuration, musicFade);

    this.project.buildInfos.musicFilters.push(` ${resolved.filter}`);

    if (resolved.crossfade) {
      this.project.buildInfos.musicFilters.push(resolved.crossfade);
    }

    this.project.buildInfos.currentLength = resolved.nextCurrentLength;
  }

  // Comma-prefixed normalize filter string inserted at the end of the chain that produces
  // [final] (a labeled output ends an ffmpeg chain, so the filter must come BEFORE the label).
  private buildNormalizeSuffix(): string {
    const filters: Record<string, string> = {
      loudnorm: ',loudnorm=I=-16:TP=-1.5:LRA=11',
      dynaudnorm: ',dynaudnorm=f=150:g=15',
    };
    const n = this.template.descriptor.global?.audio?.normalize ?? '';

    return filters[n] ?? '';
  }

  // Ducking mix: sidechain-compresses music under voice when ducking is enabled, then amix.
  private buildDuckingMix(musicLabel: string, voiceLabel: string, normalizeSuffix: string): string {
    const duckingConfig = this.template.descriptor.global?.audio?.ducking;
    const isDucking = duckingConfig === true || typeof duckingConfig === 'object';

    if (!isDucking) {
      return `[${voiceLabel}][${musicLabel}]amix=inputs=2:duration=first${normalizeSuffix}[final]`;
    }

    const cfg = typeof duckingConfig === 'object' ? duckingConfig : {};
    const sc = `sidechaincompress=threshold=${cfg.threshold ?? 0.05}:ratio=${cfg.ratio ?? 8}:attack=${cfg.attack ?? 20}:release=${cfg.release ?? 400}`;

    return (
      `[${voiceLabel}]asplit=2[vout][vkey]; ` +
      `[${musicLabel}][vkey]${sc}[ducked]; ` +
      `[vout][ducked]amix=inputs=2:duration=first:normalize=0${normalizeSuffix}[final]`
    );
  }

  private buildFilterComplex(
    segments: Section[],
    audioVolumeLevel: number,
    reduceNoiseConfig: string,
    channelConfig: string,
    hasSegmentAudio: boolean
  ): string {
    const hasMultipleSegments = segments.length > 1;
    const normalizeSuffix = this.buildNormalizeSuffix();

    // Video-only upload: the concat output has no audio stream, so referencing
    // `[0:a]` would abort ("Stream specifier matches no streams"). Route the
    // music straight to [final] instead of amix-ing it with absent segment audio.
    if (!hasSegmentAudio) {
      if (hasMultipleSegments) {
        return `${this.project.buildInfos.musicFilters.join(' ')} [lastcrossed]${channelConfig}${normalizeSuffix}[final]`;
      }

      return `[1:a]${channelConfig}${normalizeSuffix}[final]`;
    }

    let filterComplex = `[0:a]${channelConfig},volume=${audioVolumeLevel},${reduceNoiseConfig}[audio_formatted]; `;

    if (hasMultipleSegments) {
      filterComplex += `${this.project.buildInfos.musicFilters.join(' ')} `;
      filterComplex += `[lastcrossed]${channelConfig}[music_formatted]; `;

      return `${filterComplex}${this.buildDuckingMix('music_formatted', 'audio_formatted', normalizeSuffix)}`;
    }

    filterComplex += `[1:a]${channelConfig}[music_formatted]; `;

    return `${filterComplex}${this.buildDuckingMix('music_formatted', 'audio_formatted', normalizeSuffix)}`;
  }

  private buildAppendMusicCommand(opts: AppendMusicOptions): string {
    const { segments, finalVideo, audioVolumeLevel, reduceNoiseConfig, sampleRate, hasSegmentAudio } = opts;
    const channelConfig = `aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=stereo`;
    const filterComplex = this.buildFilterComplex(
      segments,
      audioVolumeLevel,
      reduceNoiseConfig,
      channelConfig,
      hasSegmentAudio
    );

    let command = ` -y ${opts.videoInputArgs} -i ${this.project.buildInfos.musicPath} `;
    command += ` -filter_complex "${filterComplex}" `;
    // +faststart so the music-mixed final output previews in a browser <video> (moov to the front),
    // matching the concat/single-file paths. -shortest bounds the muxed output to the (finite, stream-
    // copied) video stream — without it a longer music tail (e.g. after loopMusic overshoots, or a
    // music-only graph with no video-derived audio length) would extend the output past the video.
    command += ` -map 0:v -map "[final]" -c:v copy -c:a aac -ac 2 -movflags +faststart -shortest ${finalVideo} `;

    return command;
  }

  /**
   * Mix background music with video audio
   */
  appendMusic = async (segments: Section[], finalVideo: string, videoSource?: VideoSource): Promise<void> => {
    const source: VideoSource = videoSource ?? { kind: 'file', path: finalVideo };
    const reduceNoiseConfig = 'afftdn=nr=20:nf=-20';

    const audioVolumeLevel = this.template.descriptor.global?.audio?.sourceVolume ?? 1;
    const sampleRate = this.project.config.audioConfig?.sampleRate;

    const resolved = await resolveVideoInput(source, this.filesystemAdapter, 'tmp_video');
    const { videoInputArgs, probeTarget, tempToClean } = resolved;

    // Probe for an audio stream (a video-only upload has none) so the filtergraph doesn't reference a
    // missing `[0:a]`. For concat, probeTarget is the first segment — uniform streams match the whole.
    const hasSegmentAudio = (await this.ffmpegAdapter.getInfos(probeTarget)).audioCodec !== null;

    const command = this.buildAppendMusicCommand({
      videoInputArgs,
      segments,
      finalVideo,
      audioVolumeLevel,
      reduceNoiseConfig,
      sampleRate,
      hasSegmentAudio,
    });

    this.logger.debug(`[Music][Command] ffmpeg ${command}`);
    const result = await this.ffmpegAdapter.execute(command);
    this.logger.info(`[Music] ffmpeg process exited with rc ${result.rc}`);

    if (result.rc === 1) {
      throw new Error('Error on music add');
    }

    if (tempToClean) {
      await this.filesystemAdapter.unlink(tempToClean);
    }
  };

  // True when the template requests loudnorm/dynaudnorm — lets the director decide whether a
  // normalize pass will run (and thus whether the concat can fold into it) without duplicating the
  // descriptor logic.
  hasNormalization = (): boolean => this.buildNormalizeSuffix() !== '';

  /**
   * Apply audio normalization to a final video when music is disabled. Called after assembly when
   * global.audio.normalize is set and music is not enabled.
   *
   * Runs a single-pass normalize filter (loudnorm or dynaudnorm) via `-af`, copies the video stream,
   * and writes finalVideo. A concat `videoSource` lets it consume the segment list directly (folding
   * the standalone concat into this pass); the default file source preserves the move-in-place flow.
   */
  normalizeAudio = async (finalVideo: string, videoSource?: VideoSource): Promise<void> => {
    const normalizeSuffix = this.buildNormalizeSuffix();

    if (!normalizeSuffix) {
      return;
    }

    // Strip the leading comma so it can be used as a standalone -af value.
    const afFilter = normalizeSuffix.slice(1);
    const source = videoSource ?? { kind: 'file' as const, path: finalVideo };
    const { videoInputArgs, tempToClean } = await resolveVideoInput(source, this.filesystemAdapter, 'tmp_normalize');

    const command = ` -y ${videoInputArgs} -af "${afFilter}" -c:v copy -movflags +faststart ${finalVideo} `;

    this.logger.debug(`[Music][Normalize] ffmpeg ${command}`);
    const result = await this.ffmpegAdapter.execute(command);
    this.logger.info(`[Music][Normalize] ffmpeg process exited with rc ${result.rc}`);

    if (result.rc === 1) {
      throw new Error('Error on audio normalization');
    }

    if (tempToClean) {
      await this.filesystemAdapter.unlink(tempToClean);
    }
  };

  /**
   * Loop music track to match video duration
   */
  loopMusic = async (): Promise<void> => {
    const { totalLength, musicPath } = this.project.buildInfos;
    // `loadMusic` returns early (leaving musicPath empty) when the template enables music but no track
    // is actually selected/resolved. Probing an empty path makes ffprobe fail — skip looping instead.
    if (!musicPath) {
      this.logger.info('[Music] No music track resolved — skipping loop.');

      return;
    }

    await this.musicAdapter.process(this.logger, this.filesystemAdapter, totalLength, musicPath);
  };
}

export default MusicComposer;
