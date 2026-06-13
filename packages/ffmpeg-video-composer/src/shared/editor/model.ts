// Types, interfaces, constants, and section factories for the template editor model.
// Consumed by buildDescriptor, operations, and toEditorState — pure, no React/DOM/RN dep.
import type { z } from 'zod';
import type { TemplateDescriptor } from '../../core/types';

// Re-export the core descriptor type so both apps can pin their stored-template shapes to the
// exact descriptor buildDescriptor emits / toEditorState consumes — keeping the editor in lock-step.
export type { TemplateDescriptor } from '../../core/types';
import type {
  GradeSchema,
  MotionEffectSchema,
  BackgroundLayerSchema,
  FramingGuideSchema,
} from '../../schemas/effects.schemas';
import { FONTS, DEFAULT_FONT_ID } from '../library/fonts';

export type MediaChoice = { source: 'library'; id: string } | { source: 'upload'; key: string; label: string };

// v2 builder feature types, inferred from the core zod schemas so they can never drift.
export type Grade = z.infer<typeof GradeSchema>;
export type MotionEffect = z.infer<typeof MotionEffectSchema>;
export type BackgroundLayer = z.infer<typeof BackgroundLayerSchema>;
export type FramingGuide = z.infer<typeof FramingGuideSchema>;

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

export type EditorSection =
  | { kind: 'form'; fields: FormField[] }
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
    } & VisualAudio)
  | ({
      kind: 'color';
      duration: number;
      color: string;
      transitionAfter?: SectionTransition;
      look?: string;
      grade?: Grade;
      motion?: MotionEffect[];
      layers?: BackgroundLayer[];
    } & VisualAudio)
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
    } & VisualAudio);

export type Orientation = 'landscape' | 'portrait';

// Global audio mix applied across the whole composition: the recorded clips' own audio
// (sourceVolume) vs the background music (musicVolume), each 0..1. normalize/ducking are v2
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

export interface EditorState {
  id: string;
  name: string;
  description: string;
  orientation: Orientation;
  sections: EditorSection[];
  globalVariables: { name: string; value: string }[];
  audio: AudioMix;
  defaultTransition: DefaultTransition;
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
  video: 'Your video',
  color: 'Color background',
  music: 'Background music',
  image: 'Background image',
};

export const SECTION_KINDS: Array<EditorSection['kind']> = ['video', 'form', 'color', 'music', 'image'];

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
  if (kind === 'form') return { kind: 'form', fields: [{ name: 'firstname', label: 'Your name', maxLength: 40 }] };

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
