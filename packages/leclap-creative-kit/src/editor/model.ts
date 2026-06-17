// Types, interfaces, constants, and section factories for the template editor model.
// Consumed by buildDescriptor, operations, and toEditorState — pure, no React/DOM/RN dep.
import type { z } from 'zod';
import type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';

// Re-export the core descriptor type so both apps can pin their stored-template shapes to the
// exact descriptor buildDescriptor emits / toEditorState consumes — keeping the editor in lock-step.
export type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';
import type {
  GradeSchema,
  MotionEffectSchema,
  BackgroundLayerSchema,
  FramingGuideSchema,
} from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import type { CaptionSchema } from 'ffmpeg-video-composer/src/schemas/section.schemas.ts';
import { FONTS, DEFAULT_FONT_ID } from '../fonts';

export type MediaChoice =
  | { source: 'library'; id: string }
  | { source: 'upload'; key: string; label: string }
  | { source: 'url'; url: string };

// Builder feature types, inferred from the core zod schemas so they can never drift.
export type Grade = z.infer<typeof GradeSchema>;
export type MotionEffect = z.infer<typeof MotionEffectSchema>;
export type BackgroundLayer = z.infer<typeof BackgroundLayerSchema>;
export type FramingGuide = z.infer<typeof FramingGuideSchema>;
export type DescriptorCaption = z.infer<typeof CaptionSchema>;
export type CaptionPosition = NonNullable<DescriptorCaption['position']>;
export type CaptionStyle = NonNullable<DescriptorCaption['style']>;
export type CaptionAlign = NonNullable<DescriptorCaption['align']>;

// --- Editor-friendly section model (flattened; compiled to a descriptor on save) ---
export type FormField = { name: string; label: string; maxLength: number };

// A single positionable text overlay on a video section. x/y are [0,1] fractions
// of the frame; fontcolor/boxcolor are hex strings like '#ffffff'. boxOpacity is
// the background box alpha in [0,1].
export interface TextOverlay {
  text: string;
  x: number;
  y: number;
  fontsize: number;
  fontcolor: string;
  font: string;
  box: boolean;
  boxcolor: string;
  boxOpacity: number;
}

// A transition emitted after a visual section (maps to section.transition).
export interface SectionTransition {
  type: string;
  duration?: number;
}

// Per-section audio fade: applied to the music track at the start / end of a section.
export interface AudioFadeSide {
  duration: number;
  curve?: string;
}

export interface SectionAudioFade {
  in?: AudioFadeSide;
  out?: AudioFadeSide;
}

// Visual-section audio extras: per-section music-volume override and fade-in/out.
// Co-located with look/grade/motion because they all ride on visual sections only.
export interface VisualAudio {
  musicVolume?: number;
  audioFade?: SectionAudioFade;
}

export interface EditorCaption {
  text: string;
  textI18n?: DescriptorCaption['text'];
  position?: CaptionPosition;
  style?: CaptionStyle;
  align?: CaptionAlign;
  font?: string;
  fontsize?: number;
  color?: string;
  box?: boolean;
  boxColor?: string;
  boxOpacity?: number;
}

export interface VisualCaption {
  caption?: EditorCaption;
}

// A looping animated overlay (.apng/.webp/.gif/.webm) composited over a visual section — a brand
// border, falling confetti, an icon flourish. `url` is a library path (/assets/animations/x.apng)
// or an uploaded blob/data URL; `label` is the library name or uploaded filename, shown in the picker.
// `position`/`scale` tune the overlay for the template: "x:y" output px and "w:h" pre-composite px
// (-1 = keep aspect). Both optional — omitted means top-left at the file's native size.
export interface AnimationOverlay {
  // Editor-only stable key for list rendering/reorder; never written to the descriptor. Optional so
  // the picker can emit a transient overlay (url+label) before the list wrapper attaches an id.
  id?: string;
  url: string;
  label?: string;
  position?: string;
  scale?: string;
  // Playback extent — exactly one of these is active (the builder's mode control enforces it):
  // `loop` (forever) → `-stream_loop -1`; `loops` (finite count) → `-stream_loop N-1`; `duration`
  // (seconds) → `-stream_loop -1 -t D`. Engine precedence: duration > loops > loop.
  loop?: boolean;
  loops?: number;
  duration?: number;
  // Seconds to delay the overlay before it appears (via -itsoffset). Default 0 = from the beginning.
  start?: number;
  // `persistent` → overlay `eof_action=repeat` (freeze the last frame on end) once the overlay ends.
  persistent?: boolean;
  // Overlay alpha, 0–1. Omitted means fully opaque (1).
  opacity?: number;
  // Clockwise rotation in degrees applied to the overlay before compositing. Omitted/0 = upright.
  rotation?: number;
}

// A positionable still-image layer on a video section — dragged/resized exactly like an
// AnimationOverlay, but a static image picked from the library or uploaded. The source is a
// MediaChoice (library / upload / url) so large images stay out of the descriptor (uploads resolve
// to `media://<key>` and are materialized at compile), unlike animations which inline a data: URL.
// `position`/`scale` use the same "x:y" output-px / "w:h" pre-composite-px convention as animations.
// `id` is an editor-only stable key for list rendering/reorder; it is never written to the descriptor.
export interface ImageOverlay {
  id: string;
  choice: MediaChoice;
  position?: string;
  scale?: string;
  // Overlay alpha, 0–1. Omitted means fully opaque (1). Same convention as AnimationOverlay.opacity.
  opacity?: number;
  // Clockwise rotation in degrees applied to the image before compositing. Omitted/0 = upright.
  rotation?: number;
}

export interface VisualAnimation {
  // Animated overlays composited over the section, in array order (later entries paint on top).
  // Author-set; empty/absent means none.
  animations?: AnimationOverlay[];
}

export type EditorSection =
  | { kind: 'form'; fields: FormField[] }
  | { kind: 'partial'; ref: string; prefix?: string; variables: { name: string; value: string }[] }
  | ({
      kind: 'video';
      duration: number;
      mute: boolean;
      overlays: TextOverlay[];
      // Recording instructions shown to the end-user while they film this scene
      // (e.g. "Stand centered, look at the camera, say your name"). Emitted as the
      // section's `description` Translation; surfaced by both recorders, never burned in.
      description?: string;
      countdown: boolean;
      countdownSeconds: number;
      // Editor-only: true once the author hand-edits countdownSeconds, which stops it
      // from auto-tracking the clip duration. Never written to the descriptor.
      countdownCustomized?: boolean;
      transitionAfter?: SectionTransition;
      look?: string;
      grade?: Grade;
      motion?: MotionEffect[];
      framingGuide?: FramingGuide;
      // Still-image layers dragged/resized on the preview and composited OVER the recorded clip,
      // in array order (later entries paint on top). Author-set; empty/absent means none.
      images?: ImageOverlay[];
    } & VisualAudio &
      VisualCaption &
      VisualAnimation)
  | ({
      kind: 'color';
      duration: number;
      color: string;
      transitionAfter?: SectionTransition;
      look?: string;
      grade?: Grade;
      motion?: MotionEffect[];
      layers?: BackgroundLayer[];
    } & VisualAudio &
      VisualCaption &
      VisualAnimation)
  | { kind: 'music'; allowed: string[]; allowUpload: boolean }
  | ({
      kind: 'image';
      allowed: string[];
      allowUpload: boolean;
      duration: number;
      transitionAfter?: SectionTransition;
      look?: string;
      grade?: Grade;
      motion?: MotionEffect[];
    } & VisualAudio &
      VisualCaption &
      VisualAnimation);

export type Orientation = 'landscape' | 'portrait';

// Global audio mix applied across the whole composition: the recorded clips' own audio
// (sourceVolume) vs the background music (musicVolume), each 0..1. normalize/ducking are
// finishing options surfaced by the builder.
export interface AudioMix {
  sourceVolume: number;
  musicVolume: number;
  normalize?: 'loudnorm' | 'dynaudnorm';
  ducking: boolean;
}

export const DEFAULT_AUDIO_MIX: AudioMix = { sourceVolume: 1, musicVolume: 0.5, ducking: false };

// Default cross-section transition (maps to global.transition).
export interface DefaultTransition {
  type: string;
  duration: number;
}

export const DEFAULT_TRANSITION: DefaultTransition = { type: 'cut', duration: 0.5 };

// Opacity used for a framing-guide silhouette when none is authored. Shared by the authoring
// pickers (web + expo) and the live recording overlays so an unspecified guide renders exactly as
// a freshly-added one. The guide is a recording aid only — never burned into the video.
export const DEFAULT_FRAMING_OPACITY = 0.45;

export interface EditorState {
  id: string;
  name: string;
  description: string;
  orientation: Orientation;
  sections: EditorSection[];
  globalVariables: { name: string; value: string }[];
  audio: AudioMix;
  defaultTransition: DefaultTransition;
  // Whole-video animation overlays (descriptor global.animations) — composited over the final joined
  // video so they span every section, unlike a section's own animation. Empty means none.
  globalAnimations: AnimationOverlay[];
}

/** Minimal shape needed to re-hydrate the editor from a saved template (web Template + expo UserTemplate both satisfy it). */
export interface EditableTemplate {
  id: string;
  name: string;
  description: string;
  orientation: Orientation;
  descriptor: TemplateDescriptor;
}

export const SECTION_LABELS: Record<EditorSection['kind'], string> = {
  form: 'Form fields',
  partial: 'Partial',
  video: 'Your video',
  color: 'Color background',
  music: 'Background music',
  image: 'Background image',
};

export const SECTION_KINDS: Array<EditorSection['kind']> = ['video', 'form', 'color', 'music', 'image', 'partial'];

// A fresh, centered text overlay with sensible defaults.
export function newOverlay(): TextOverlay {
  return {
    text: '',
    x: 0.5,
    y: 0.5,
    fontsize: 48,
    fontcolor: '#ffffff',
    font: DEFAULT_FONT_ID,
    box: false,
    boxcolor: '#000000',
    boxOpacity: 0.5,
  };
}

// Resolve a font id from a stored drawtext `fontfile`, falling back to the
// default font when the file is unknown or missing.
export function fontIdFromFile(file: string | undefined): string {
  return FONTS.find((f) => f.file === file)?.id ?? DEFAULT_FONT_ID;
}

export function newSection(kind: EditorSection['kind']): EditorSection {
  if (kind === 'form') return { kind: 'form', fields: [{ name: 'field_1', label: 'Label', maxLength: 40 }] };

  if (kind === 'partial') return { kind: 'partial', ref: '', variables: [] };

  if (kind === 'color') return { kind: 'color', duration: 3, color: '#7C83FD' };

  if (kind === 'music') return { kind: 'music', allowed: [], allowUpload: false };

  if (kind === 'image') return { kind: 'image', allowed: [], allowUpload: false, duration: 4 };

  return { kind: 'video', duration: 8, mute: false, overlays: [], countdown: false, countdownSeconds: 4 };
}

export function makeTemplateId(): string {
  try {
    // Typed as optional: the DOM lib guarantees crypto.randomUUID, but Hermes (RN) may not have it.
    const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    const uuid = webCrypto?.randomUUID?.();

    if (uuid) return `user-${uuid}`;
  } catch {
    // fall through to a timestamp-based id
  }

  return `user-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}
