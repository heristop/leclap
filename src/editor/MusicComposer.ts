import { inject, injectable } from 'tsyringe';
import { MusicConfig, Section } from '@/core/types';
import AbstractLogger from '@/platform/logging/AbstractLogger';
import AbstractFFmpeg from '@/platform/ffmpeg/AbstractFFmpeg';
import AbstractFilesystem from '@/platform/filesystem/AbstractFilesystem';
import AbstractMusic from '@/platform/ffmpeg/AbstractMusic';
import Template from '@/core/models/Template';
import Project from '@/core/models/Project';

/**
 * Handles all music-related operations for video composition
 * including loading, processing, looping, and mixing with video audio
 */
@injectable()
class MusicComposer {
  private buildAssetsDir: string;
  private musicAssetsDir: string;

  constructor(
    private readonly project: Project,
    private readonly template: Template,

    @inject('logger') private readonly logger: AbstractLogger,
    @inject('ffmpegAdapter') private readonly ffmpegAdapter: AbstractFFmpeg,
    @inject('filesystemAdapter')
    private readonly filesystemAdapter: AbstractFilesystem,
    @inject('musicAdapter') private readonly musicAdapter: AbstractMusic
  ) {}

  /**
   * Loads and prepares the background music track
   * Checks cache first, then downloads if needed
   */
  loadMusic = async (): Promise<void> => {
    this.buildAssetsDir = await this.filesystemAdapter.getBuildPath('assets');
    this.musicAssetsDir = await this.filesystemAdapter.getAssetsPath('musics');

    if (!this.project.config.music) {
      // Fallback to template music if project doesn't specify one
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
    } else if (this.project.config.music.url) {
      this.logger.info(`[Music] Fetching ${this.project.config.music.url}`);
      await this.downloadAndSaveMusic(this.project.config.music.url, destination);
      this.project.buildInfos.musicPath = destination;
    } else {
      throw new Error('Music URL is not provided.');
    }
  };

  /**
   * Downloads and saves music file to the specified destination
   */
  private async downloadAndSaveMusic(url: string, destination: string): Promise<void> {
    const musicPath = await this.downloadMusic(url);
    await this.filesystemAdapter.move(musicPath, destination);
    this.logger.info(`[Music] Fetched ${destination}`);
  }

  /**
   * Downloads music file using filesystem adapter
   */
  private async downloadMusic(url: string): Promise<string> {
    return await this.filesystemAdapter.fetch(url);
  }

  /**
   * Formats music name based on config
   * Extracts name from URL if not provided explicitly
   */
  private formatMusicName(music: MusicConfig): string {
    if (music.name) {
      return this.removeExtension(music.name);
    }

    const urlParts = music.url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    return this.removeExtension(fileName);
  }

  /**
   * Removes file extension from filename
   */
  private removeExtension(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '');
  }

  /**
   * Checks if a music file exists in the cache
   */
  private async checkMusicExists(filePath: string): Promise<boolean> {
    return await this.filesystemAdapter.stat(filePath);
  }

  /**
   * Prepares audio filters and settings for a video segment
   * Handles volume, transitions, and crossfades between segments
   * @param section - Video section to prepare music for
   */
  prepareMusicTrack = (section: Section): void => {
    const sectionData = this.template.descriptor[section.name];

    // Initialize audio settings
    let musicVolumeLevel = section.options.musicVolumeLevel ?? 0.5;
    let transitionDuration = this.template.descriptor.global.transitionDuration ?? 0.3;
    this.project.buildInfos.currentLength ??= 0.0;

    // Calculate duration based on section type
    const duration =
      section.type === 'project_video' && sectionData?.info
        ? this.project.buildInfos.durations[section.name]
        : (section.options.duration ?? 0);

    // Setup section metadata
    const sectionIncrement = this.project.buildInfos.currentIncrement + 1;
    const isFirstSection = sectionIncrement === 1;
    const isLastSection = sectionIncrement == this.project.buildInfos.totalSegments;
    const mapName = isLastSection ? 'lastsection' : `section${sectionIncrement}`;

    this.project.buildInfos.currentIncrement = sectionIncrement;

    // Calculate segment timing
    const ss = this.project.buildInfos.currentLength;
    const t = duration + transitionDuration;
    this.project.buildInfos.currentLength += duration;

    // Build audio filters based on section position
    const baseFilter = `[1:a]atrim=start=${ss}:duration=${t},asetpts=PTS-STARTPTS`;
    let filter: string;

    if (isFirstSection) {
      filter = `${baseFilter},afade=t=in:st=0:d=${transitionDuration},volume=${musicVolumeLevel}[${mapName}];`;
    } else if (isLastSection) {
      filter = `${baseFilter},afade=t=out:st=${duration - transitionDuration}:d=${transitionDuration},volume=${musicVolumeLevel}[${mapName}];`;
    } else {
      filter = `${baseFilter},volume=${musicVolumeLevel}[${mapName}];`;
    }

    this.project.buildInfos.musicFilters.push(` ${filter}`);

    // Add crossfade between segments
    if (sectionIncrement > 1) {
      const acrossfadeMapName = isLastSection ? 'lastcrossed' : `crossed${sectionIncrement - 1}`;
      const previousMapName =
        sectionIncrement === 2 ? `section${sectionIncrement - 1}` : `crossed${sectionIncrement - 2}`;

      const crossfade = ` [${previousMapName}][${mapName}]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${acrossfadeMapName}];`;
      this.project.buildInfos.musicFilters.push(crossfade);
    }
  };

  /**
   * Appends background music to the final video
   * Handles audio mixing, noise reduction, and channel configuration
   * @param segments - Video segments to process
   * @param finalVideo - Path to the final video file
   */
  appendMusic = async (segments: Section[], finalVideo: string): Promise<void> => {
    const time = new Date().getTime();
    const temp = `${this.filesystemAdapter.getTempDir()}/tmp_video_${time}.mp4`;
    const reduceNoiseConfig = 'afftdn=nr=20:nf=-20';

    const audioVolumeLevel = this.template.descriptor.global.audioVolumeLevel ?? 1;
    const sampleRate = this.project.config.audioConfig.sampleRate;

    await this.filesystemAdapter.move(finalVideo, temp);

    // Configure audio format and channels
    const channelConfig = `aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=stereo`;

    // Build FFmpeg command with appropriate filters
    let command = ` -y -i ${temp} -i ${this.project.buildInfos.musicPath} `;
    let filterComplex = `[0:a]${channelConfig},volume=${audioVolumeLevel},${reduceNoiseConfig}[audio_formatted]; `;

    if (segments.length > 1) {
      filterComplex += `${this.project.buildInfos.musicFilters.join(' ')} `;
      filterComplex += `[lastcrossed]${channelConfig}[music_formatted]; `;
      filterComplex += '[audio_formatted][music_formatted]amix=inputs=2:duration=first[final]';
    } else {
      filterComplex += `[1:a]${channelConfig}[music_formatted]; `;
      filterComplex += `[audio_formatted][music_formatted]amix=inputs=2:duration=first[final]`;
    }

    command += ` -filter_complex "${filterComplex}" `;
    command += ` -map 0:v -map "[final]" -c:v copy -c:a aac -ac 2 ${finalVideo} `;

    this.logger.info(`[Music][Command] ffmpeg ${command}`);
    const result = await this.ffmpegAdapter.execute(command);
    this.logger.info(`[Music] ffmpeg process exited with rc ${result.rc}`);

    if (result.rc === 1) {
      throw new Error('Error on music add');
    }

    await this.filesystemAdapter.unlink(temp);
  };

  /**
   * Loops music track if it's shorter than the video duration
   */
  loopMusic = async (): Promise<void> => {
    const { totalLength, musicPath } = this.project.buildInfos;
    await this.musicAdapter.process(this.logger, this.filesystemAdapter, totalLength, musicPath);
  };
}

export default MusicComposer;
