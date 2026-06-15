export type LogParams = Record<string, unknown>;

export type ProjectConfig = {
  buildDir?: string;
  assetsDir?: string;
  music?: MusicConfig;
  fields?: Record<string, string>;
  currentLocale?: string;
  codecConfig?: CodecConfig;
  hardwareConfig?: HardwareConfig;
  audioConfig?: AudioConfig;
  videoConfig?: VideoConfig;
  userVideoPaths?: { [sectionName: string]: string };
};

export type MusicConfig = {
  name: string;
  url?: string;
};

type CodecConfig = {
  videoCodec?: string;
  audioCodec?: string;
};

type HardwareConfig = {
  hwaccel?: string | null;
  preset?: string;
};

type AudioConfig = {
  sampleRate?: number;
  channelLayout?: string;
};

type VideoConfig = {
  orientation?: string;
  scale?: string;
  setsar?: string;
};

export type ProjectBuildInfos = {
  totalSegments: number;
  totalLength: number;
  currentLength: number;
  currentProgress: number;
  currentIncrement: number;
  durations: Record<string, number>;
  videoInputs: string[];
  musicInputs: string[];
  musicFilters: string[];
  fileConcatPath: string;
  musicPath: string;
  transitions: Array<{ type: string; duration: number }>;
};

// Descriptor
export interface TemplateDescriptor {
  meta?: TemplateMeta;
  global?: TemplateDescriptorGlobal;
  sections?: DescriptorSection[];
}

interface TemplateMeta {
  name?: string;
  description?: string;
}

interface TemplateDescriptorGlobal {
  variables?: Variables;
  orientation?: string;
  colorsList?: string[];
  musicEnabled?: boolean;
  transition?: SectionTransition;
  audio?: GlobalAudio;
  music?: MusicConfig;
  allowedMusic?: string[];
  allowUploadMusic?: boolean;
  allowedBackgrounds?: string[];
  allowUploadBackground?: boolean;
}

interface SectionTransition {
  type: string;
  duration?: number;
}

interface DuckingConfig {
  threshold?: number;
  ratio?: number;
  attack?: number;
  release?: number;
}

interface GlobalAudio {
  sourceVolume?: number;
  musicVolume?: number;
  normalize?: 'loudnorm' | 'dynaudnorm';
  ducking?: boolean | DuckingConfig;
}

export interface Variables {
  [key: string]: string | string[];
}

type DescriptorSection = Section | PartialSection;

export interface Section {
  name: string;
  type: string;
  options?: SectionOptions;
  inputs?: Input[];
  maps?: Map[];
  filters?: Filter[];
  title?: Translation;
  description?: Translation;
  transition?: SectionTransition;
  caption?: Caption;
  look?: string;
  grade?: GradeConfig;
  motion?: MotionEffect[];
}

export interface PartialSection {
  type: 'partial';
  name?: string;
  options?: SectionOptions;
  inputs?: Input[];
  maps?: Map[];
  filters?: Filter[];
  title?: Translation;
  description?: Translation;
  transition?: SectionTransition;
  caption?: Caption;
  look?: string;
  grade?: GradeConfig;
  motion?: MotionEffect[];
  ref?: string;
  prefix?: string;
  sections?: unknown[];
  variables?: Record<string, string>;
}

export interface Caption {
  text: Record<string, string>;
  style?: 'bar' | 'subtle' | 'bold';
  position?: 'top' | 'center' | 'bottom' | 'lower-third';
  align?: 'left' | 'center' | 'right';
  font?: string;
  fontsize?: number;
  color?: string;
  box?: boolean;
  boxColor?: string;
  boxOpacity?: number;
}

interface AudioFade {
  duration: number;
  curve?: string;
}

interface SectionOptions {
  upperCase?: boolean;
  lowerCase?: boolean;
  useVideoSection?: string;
  duration?: number;
  musicVolume?: number;
  audioFade?: { in?: AudioFade; out?: AudioFade };
  fields?: Field[];
  speed?: number;
  muteSection?: boolean;
  countdown?: boolean;
  countdownDuration?: number;
  videoUrl?: string;
  logoUrl?: string;
  backgroundUrl?: string;
  pictureUrl?: string;
  backgroundColor?: string;
  forceAspectRatio?: boolean;
  forceOriginalAspectRatio?: boolean;
  // color_background extension
  layers?: BackgroundLayer[];
  // project_video extension
  framingGuide?: FramingGuideConfig;
}

interface ChannelAdjust {
  r?: number;
  g?: number;
  b?: number;
}

interface GradeConfig {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  gamma?: number;
  hue?: number;
  colorBalance?: {
    shadows?: ChannelAdjust;
    midtones?: ChannelAdjust;
    highlights?: ChannelAdjust;
  };
  blur?: number;
  curvesPreset?: string;
}

type MotionEffect =
  | { type: 'kenburns'; direction?: 'in' | 'out' | 'left' | 'right' | 'up' | 'down'; intensity?: number }
  | { type: 'rotate'; angle: number }
  | { type: 'crop'; w: number | string; h: number | string; x?: number | string; y?: number | string }
  | { type: 'flip'; axis: 'horizontal' | 'vertical' };

interface BackgroundLayer {
  color?: string;
  opacity?: number;
  x?: number | string;
  y?: number | string;
  w?: number | string;
  h?: number | string;
  gradient?: { from: string; to: string; direction?: 'horizontal' | 'vertical' | 'diagonal' };
}

interface FramingGuideConfig {
  type: 'silhouette';
  position: 'left' | 'center' | 'right';
  opacity?: number;
  style?: 'bust' | 'outline';
}

interface Input {
  name: string;
  url?: string;
  type?: 'animation';
  options?: InputOptions;
  filters?: Filter[];
}

interface InputOptions {
  fps?: number;
  position?: string;
  scale?: string;
  persistent?: boolean;
  loop?: boolean;
}

export interface Map {
  inputs: string[];
  outputs: string[];
  filters?: Filter[];
  options?: MapOptions;
}

type MapOptions = {
  useSectionFilters?: boolean;
};

export interface Filter {
  type: string;
  value?: string | number;
  values?: FilterValues;
  range?: string;
}

interface FilterValues {
  h?: number | string;
  w?: number | string;
  x?: number | string;
  y?: number | string;
  c?: string;
  t?: string | number;
  text?: Translation;
  fontcolor?: string;
  fontsize?: number | string;
  fontfile?: string;
  alpha?: string;
  d?: string;
  st?: string;
  color?: string;
  box?: number | string;
  boxcolor?: string;
  boxborderw?: number | string;
}

interface Translation {
  [key: string]: string | undefined;
}

interface Field {
  name: string;
  maxLength: number;
  label: Translation;
}

export type Media = {
  name: string;
  url?: string;
  path?: string;
  extension?: string;
};

export type TemplateAssets = {
  fonts: Record<string, string>;
  musics: Record<string, string>;
  inputs: string[];
};

type MapAnimationOptions = {
  fps: number;
  position: string;
  scale: string;
  persistent: boolean;
  loop: boolean;
};

export type MapAnimationInput = {
  url: string;
  name: string;
  type: string;
  extension: string;
  options: MapAnimationOptions;
  filters: Filter[];
};

export type FFMpegInfos = {
  duration: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  sampleRate: number | null;
};
