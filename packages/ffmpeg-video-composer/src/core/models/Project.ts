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
    sourceHasAudio: {},
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
      sourceHasAudio: {},
      videoInputs: [],
      musicInputs: [],
      musicFilters: [],
      fileConcatPath: '',
      musicPath: '',
      transitions: [],
    };
  };

  /**
   * Clear every field a build accumulates, at the START of the next compile. This is a singleton
   * (registerInstance) reused across compiles in a long-lived process (browser / on-device), and
   * emitFinalize skips clean() whenever `errors` is non-empty — so without this, an errored compile
   * leaves stale state (and a non-empty `errors` that permanently disables clean()) that corrupts
   * every later compile. The load-bearing field is `videoInputs`: append() PUSHES each rendered
   * segment path to it, so a leftover entry makes the next compile's transition assembly probe a
   * prior build's segment ("[Transitions] could not probe duration"). Cleared IN PLACE (arrays/maps
   * mutated, not reassigned) so any component holding this same instance keeps seeing the live fields.
   */
  resetBuildState = (): void => {
    const bi = this.buildInfos;
    Object.assign(bi, { totalSegments: 0, totalLength: 0, currentLength: 0, currentProgress: 0, currentIncrement: 0 });
    bi.videoInputs.length = bi.musicInputs.length = bi.musicFilters.length = bi.transitions.length = 0;
    bi.durations = {};
    bi.sourceHasAudio = {};
    this.errors.length = 0;
    this.finalVideo = '';
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
