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
type CodecConfig = { videoCodec?: string; audioCodec?: string };

type HardwareConfig = { hwaccel?: string | null; preset?: string };

type AudioConfig = { sampleRate?: number; channelLayout?: string };

type VideoConfig = { orientation?: string; scale?: string; setsar?: string };

export type ProjectBuildInfos = {
  totalSegments: number;
  totalLength: number;
  currentLength: number;
  currentProgress: number;
  currentIncrement: number;
  durations: Record<string, number>;
  // Per project_video section: whether its source clip has an audio stream. Probed once by the
  // director; false lets the segment add a silent track so transition acrossfade always has audio.
  sourceHasAudio: Record<string, boolean>;
  videoInputs: string[];
  musicInputs: string[];
  musicFilters: string[];
  fileConcatPath: string;
  musicPath: string;
  transitions: Array<{ type: string; duration: number }>;
};

export interface TemplateDescriptor {
  meta?: TemplateMeta;
  global?: TemplateDescriptorGlobal;
  sections?: DescriptorSection[];
}

interface TemplateMeta {
  name?: string;
  description?: string;
}

export interface TemplateDescriptorGlobal {
  variables?: Variables;
  orientation?: string;
  colorsList?: string[];
  musicEnabled?: boolean;
  transition?: SectionTransition;
  audio?: GlobalAudio;
  music?: MusicConfig;
  animations?: GlobalAnimation[];
  overlays?: GlobalTextOverlay[];
  look?: string;
  grade?: GradeConfig;
  allowedMusic?: string[];
  allowUploadMusic?: boolean;
  allowedBackgrounds?: string[];
  allowUploadBackground?: boolean;
}

// A whole-video text overlay (global.overlays) composited onto every section (or a named subset).
export interface GlobalTextOverlay {
  text: Translation;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'center';
  font?: string;
  size?: number;
  color?: string;
  opacity?: number;
  reveal?: Reveal;
  effect?: TextEffect;
  sections?: string[];
}

// A whole-video animation overlay (global.animations) composited over the final joined video.
export interface GlobalAnimation {
  url: string;
  position?: string;
  scale?: string;
  opacity?: number;
  /** Clockwise rotation in degrees applied to the overlay before compositing. 0 (or omitted) = upright. */
  rotation?: number;
  loop?: boolean;
  /** Finite play count; takes precedence over loop. */
  loops?: number;
  /** Seconds the overlay plays before it ends; takes precedence over loops/loop. */
  duration?: number;
  /** Seconds to delay the overlay before it appears (via -itsoffset); 0/omitted starts at the beginning. */
  start?: number;
  persistent?: boolean;
  /** Animated entrance (rise/slide/fade); applied by the per-section overlay path, ignored whole-video. */
  motion?: Reveal;
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

export interface TitleCard {
  kicker?: Translation;
  headline?: Translation;
  subtitle?: Translation;
  accent?: string;
  align?: 'left' | 'center';
  background?: string;
  reveal?: Reveal;
  fade?: { in?: boolean; out?: boolean };
}

export interface LowerThird {
  title?: Translation;
  subtitle?: Translation;
  accent?: string;
  boxOpacity?: number;
  position?: 'bottom' | 'top';
  badge?: Translation;
  reveal?: Reveal;
}

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
  titleCard?: TitleCard;
  lowerThird?: LowerThird;
  look?: string;
  grade?: GradeConfig;
  motion?: MotionEffect[];
  chromaKey?: ChromaKey;
}

export interface ChromaKey {
  color: string;
  similarity?: number;
  blend?: number;
  background?: string;
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

export type RevealType = 'none' | 'fade' | 'rise' | 'slide-left' | 'slide-right';
export type Reveal = RevealType | { type: RevealType; delay?: number; duration?: number; distance?: number };

export type TextEffect = {
  shadow?: boolean | { color?: string; dx?: number; dy?: number };
  outline?: boolean | { color?: string; width?: number };
};

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
  reveal?: Reveal;
  effect?: TextEffect;
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
  captureMode?: string;
  allowedCaptureModes?: string[];
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
  type?: 'animation' | 'image';
  options?: InputOptions;
  filters?: Filter[];
}

interface InputOptions {
  fps?: number;
  position?: string;
  scale?: string;
  persistent?: boolean;
  loop?: boolean;
  /** Finite play count; takes precedence over loop. */
  loops?: number;
  /** Seconds the overlay plays before it ends; takes precedence over loops/loop. */
  duration?: number;
  /** Seconds to delay the overlay before it appears (via -itsoffset); 0/omitted starts at the beginning. */
  start?: number;
  /** Overlay alpha, 0–1. 1 (or omitted) keeps the animation fully opaque. */
  opacity?: number;
  /** Clockwise rotation in degrees applied to the overlay before compositing. 0 (or omitted) = upright. */
  rotation?: number;
  /** Animated entrance for the overlay (rise/slide/fade), reusing the reveal vocabulary. */
  motion?: Reveal;
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
  loops?: number;
  duration?: number;
  start?: number;
  opacity?: number;
  motion?: Reveal;
};

export type MapAnimationInput = {
  url: string;
  name: string;
  type: string;
  extension: string;
  options: MapAnimationOptions;
  // Optional in the schema (InputSchema.filters) — builder-authored inputs omit it.
  filters?: Filter[];
};

export type FFMpegInfos = {
  duration: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  sampleRate: number | null;
};
