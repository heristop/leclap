import { singleton } from 'tsyringe';
import type { ProjectBuildInfos, ProjectConfig } from '../types';
import DefaultConfig from '../default.config';

@singleton()
class Project {
  public config: ProjectConfig = {};
  public buildInfos: ProjectBuildInfos = {
    totalSegments: 0,
    totalLength: 0,
    currentLength: 0,
    currentProgress: 0,
    currentIncrement: 0,
    durations: {},
    videoInputs: [],
    musicInputs: [],
    musicFilters: [],
    fileConcatPath: '',
    musicPath: '',
    transitions: [],
  };
  public finalVideo = '';
  public progress = 0;
  public errors: string[] = [];

  constructor() {
    this.init();
  }

  init = (): void => {
    this.buildInfos = {
      totalSegments: 0,
      totalLength: 0,
      currentLength: 0,
      currentProgress: 0,
      currentIncrement: 0,
      durations: {},
      videoInputs: [],
      musicInputs: [],
      musicFilters: [],
      fileConcatPath: '',
      musicPath: '',
      transitions: [],
    };
  };

  applyDefault = () => {
    this.config = {
      codecConfig: {
        videoCodec: DefaultConfig.VIDEO_CODEC,
        audioCodec: DefaultConfig.AUDIO_CODEC,
        ...this.config.codecConfig,
      },
      hardwareConfig: {
        hwaccel: DefaultConfig.HWACCEL,
        preset: DefaultConfig.PRESET,
        ...this.config.hardwareConfig,
      },
      audioConfig: {
        sampleRate: DefaultConfig.SAMPLE_RATE,
        channelLayout: DefaultConfig.CHANNEL_LAYOUT,
        ...this.config.audioConfig,
      },
      videoConfig: {
        orientation: DefaultConfig.ORIENTATION,
        scale: DefaultConfig.SCALE,
        setsar: DefaultConfig.SETSAR,
        ...this.config.videoConfig,
      },
      currentLocale: this.config.currentLocale ?? DefaultConfig.CURRENT_LOCALE,
      ...this.config,
    };
  };

  clean = (): void => {
    this.init();
  };
}

export default Project;
