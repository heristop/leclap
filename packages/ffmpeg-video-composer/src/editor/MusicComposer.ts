import { container, inject, injectable } from 'tsyringe';
import type { MusicConfig, Section } from '@/core/types';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type AbstractMusic from '../platform/ffmpeg/AbstractMusic';
import type Template from '../core/models/Template';
import type Project from '../core/models/Project';

type MusicFilterOptions = {
  baseFilter: string;
  isFirstSection: boolean;
  isLastSection: boolean;
  transitionDuration: number;
  duration: number;
  musicVolumeLevel: number;
  mapName: string;
};

type AppendMusicOptions = {
  temp: string;
  segments: Section[];
  finalVideo: string;
  audioVolumeLevel: number;
  reduceNoiseConfig: string;
  sampleRate: number | undefined;
  hasSegmentAudio: boolean;
};

@injectable()
class MusicComposer {
  private buildAssetsDir: string = '';
  private musicAssetsDir: string = '';

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

  /**
   * Load background music track from cache or download
   */
  loadMusic = async (): Promise<void> => {
    this.buildAssetsDir = await this.filesystemAdapter.getBuildPath('assets');
    this.musicAssetsDir = await this.filesystemAdapter.getAssetsPath('musics');

    if (!this.project.config.music) {
      if (this.template.descriptor.global?.music) {
        this.project.config.music = this.template.descriptor.global.music;
      }

      if (!this.project.config.music) {
        return;
      }
    }

    const musicFormattedName = this.formatMusicName(this.project.config.music);
    const destination = `${this.buildAssetsDir}/${musicFormattedName}.mp3`;
    const musicPathInCache = `${this.musicAssetsDir}/${musicFormattedName}.mp3`;

    if (await this.checkMusicExists(musicPathInCache)) {
      this.logger.info(`[Music] Loaded from cache ${musicPathInCache}`);
      this.project.buildInfos.musicPath = musicPathInCache;

      return;
    }

    if (this.project.config.music.url) {
      this.logger.info(`[Music] Fetching ${this.project.config.music.url}`);
      await this.downloadAndSaveMusic(this.project.config.music.url, destination);
      this.project.buildInfos.musicPath = destination;

      return;
    }

    throw new Error('Music URL is not provided.');
  };

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

  private buildMusicFilter(opts: MusicFilterOptions): string {
    const { baseFilter, isFirstSection, isLastSection, transitionDuration, duration, musicVolumeLevel, mapName } = opts;

    if (isFirstSection) {
      return `${baseFilter},afade=t=in:st=0:d=${transitionDuration},volume=${musicVolumeLevel}[${mapName}];`;
    }

    if (isLastSection) {
      return `${baseFilter},afade=t=out:st=${duration - transitionDuration}:d=${transitionDuration},volume=${musicVolumeLevel}[${mapName}];`;
    }

    return `${baseFilter},volume=${musicVolumeLevel}[${mapName}];`;
  }

  private getSectionDuration(section: Section): number {
    return section.options?.duration ?? 0;
  }

  /**
   * Configure audio filters for video segment
   */
  prepareMusicTrack = (section: Section): void => {
    const musicVolumeLevel = section.options?.musicVolumeLevel ?? 0.5;
    const transitionDuration = this.template.descriptor.global?.transitionDuration ?? 0.3;

    const duration = this.getSectionDuration(section);

    const sectionIncrement = this.project.buildInfos.currentIncrement + 1;
    const isFirstSection = sectionIncrement === 1;
    const isLastSection = sectionIncrement === this.project.buildInfos.totalSegments;
    const mapName = isLastSection ? 'lastsection' : `section${sectionIncrement}`;

    this.project.buildInfos.currentIncrement = sectionIncrement;

    const ss = this.project.buildInfos.currentLength;
    const t = duration + transitionDuration;
    this.project.buildInfos.currentLength += duration;

    const baseFilter = `[1:a]atrim=start=${ss}:duration=${t},asetpts=PTS-STARTPTS`;
    const filter = this.buildMusicFilter({
      baseFilter,
      isFirstSection,
      isLastSection,
      transitionDuration,
      duration,
      musicVolumeLevel,
      mapName,
    });

    this.project.buildInfos.musicFilters.push(` ${filter}`);

    if (sectionIncrement > 1) {
      this.appendCrossfadeFilter(sectionIncrement, mapName, isLastSection, transitionDuration);
    }
  };

  private appendCrossfadeFilter(
    sectionIncrement: number,
    mapName: string,
    isLastSection: boolean,
    transitionDuration: number
  ): void {
    const acrossfadeMapName = isLastSection ? 'lastcrossed' : `crossed${sectionIncrement - 1}`;
    const previousMapName =
      sectionIncrement === 2 ? `section${sectionIncrement - 1}` : `crossed${sectionIncrement - 2}`;

    const crossfade = ` [${previousMapName}][${mapName}]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${acrossfadeMapName}];`;
    this.project.buildInfos.musicFilters.push(crossfade);
  }

  private buildFilterComplex(
    segments: Section[],
    audioVolumeLevel: number,
    reduceNoiseConfig: string,
    channelConfig: string,
    hasSegmentAudio: boolean
  ): string {
    const hasMultipleSegments = segments.length > 1;

    // Video-only upload: the concat output has no audio stream, so referencing
    // `[0:a]` would abort ("Stream specifier matches no streams"). Route the
    // music straight to [final] instead of amix-ing it with absent segment audio.
    if (!hasSegmentAudio) {
      if (hasMultipleSegments) {
        return `${this.project.buildInfos.musicFilters.join(' ')} [lastcrossed]${channelConfig}[final]`;
      }

      return `[1:a]${channelConfig}[final]`;
    }

    let filterComplex = `[0:a]${channelConfig},volume=${audioVolumeLevel},${reduceNoiseConfig}[audio_formatted]; `;

    if (hasMultipleSegments) {
      filterComplex += `${this.project.buildInfos.musicFilters.join(' ')} `;
      filterComplex += `[lastcrossed]${channelConfig}[music_formatted]; `;

      return `${filterComplex}[audio_formatted][music_formatted]amix=inputs=2:duration=first[final]`;
    }

    filterComplex += `[1:a]${channelConfig}[music_formatted]; `;

    return `${filterComplex}[audio_formatted][music_formatted]amix=inputs=2:duration=first[final]`;
  }

  private buildAppendMusicCommand(opts: AppendMusicOptions): string {
    const { temp, segments, finalVideo, audioVolumeLevel, reduceNoiseConfig, sampleRate, hasSegmentAudio } = opts;
    const channelConfig = `aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=stereo`;
    const filterComplex = this.buildFilterComplex(
      segments,
      audioVolumeLevel,
      reduceNoiseConfig,
      channelConfig,
      hasSegmentAudio
    );

    let command = ` -y -i ${temp} -i ${this.project.buildInfos.musicPath} `;
    command += ` -filter_complex "${filterComplex}" `;
    command += ` -map 0:v -map "[final]" -c:v copy -c:a aac -ac 2 ${finalVideo} `;

    return command;
  }

  /**
   * Mix background music with video audio
   */
  appendMusic = async (segments: Section[], finalVideo: string): Promise<void> => {
    const time = Date.now();
    const temp = `${this.filesystemAdapter.getTempDir()}/tmp_video_${time}.mp4`;
    const reduceNoiseConfig = 'afftdn=nr=20:nf=-20';

    const audioVolumeLevel = this.template.descriptor.global?.audioVolumeLevel ?? 1;
    const sampleRate = this.project.config.audioConfig?.sampleRate;

    await this.filesystemAdapter.move(finalVideo, temp);

    // The concat output may have no audio stream (e.g. a video-only upload);
    // probe it so the filtergraph below doesn't reference a missing `[0:a]`.
    const hasSegmentAudio = (await this.ffmpegAdapter.getInfos(temp)).audioCodec !== null;

    const command = this.buildAppendMusicCommand({
      temp,
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

    await this.filesystemAdapter.unlink(temp);
  };

  /**
   * Loop music track to match video duration
   */
  loopMusic = async (): Promise<void> => {
    const { totalLength, musicPath } = this.project.buildInfos;
    await this.musicAdapter.process(this.logger, this.filesystemAdapter, totalLength, musicPath);
  };
}

export default MusicComposer;
