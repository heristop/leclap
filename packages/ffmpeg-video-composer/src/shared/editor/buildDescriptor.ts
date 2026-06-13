// Pure: editor state -> core TemplateDescriptor. All helpers are file-local.
import type { TemplateDescriptor, Section } from '../../core/types';
import { findFont } from '../library/fonts';
import type {
  EditorSection,
  EditorState,
  FormField,
  TextOverlay,
  SectionTransition,
  AudioMix,
  Grade,
  MotionEffect,
} from './model';

// Default authoring locale for Translation fields the editor emits (section descriptions,
// overlay/form text all key under 'en'). Single source so future i18n has one place to change.
const DEFAULT_LOCALE = 'en';

// Common visual-section passthrough fields (transition + grading + motion), only emitted when set.
function visualExtras(section: {
  transitionAfter?: SectionTransition;
  look?: string;
  grade?: Grade;
  motion?: MotionEffect[];
}): Partial<Section> {
  return {
    ...(section.transitionAfter ? { transition: section.transitionAfter } : {}),
    ...(section.look ? { look: section.look } : {}),
    ...(section.grade ? { grade: section.grade } : {}),
    ...(section.motion && section.motion.length > 0 ? { motion: section.motion } : {}),
  };
}

// Per-section audio extras — only emitted when present; undefined values are dropped entirely.
function sectionAudioOptions(section: {
  musicVolume?: number;
  audioFade?: { in?: { duration: number; curve?: string }; out?: { duration: number; curve?: string } };
}): Partial<{
  musicVolume: number;
  audioFade: { in?: { duration: number; curve?: string }; out?: { duration: number; curve?: string } };
}> {
  const out: Partial<{
    musicVolume: number;
    audioFade: { in?: { duration: number; curve?: string }; out?: { duration: number; curve?: string } };
  }> = {};

  if (section.musicVolume !== undefined) out.musicVolume = section.musicVolume;

  if (section.audioFade) out.audioFade = section.audioFade;

  return out;
}

function formDescriptorFrom(section: { kind: 'form'; fields: FormField[] }, index: number): Section {
  return {
    name: `form_${index}`,
    type: 'form',
    options: {
      fields: section.fields.map((f) => ({ name: f.name, maxLength: f.maxLength, label: { en: f.label } })),
    },
  };
}

type ColorSection = Extract<EditorSection, { kind: 'color' }>;

function colorDescriptorFrom(section: ColorSection, index: number): Section {
  return {
    name: `color_${index}`,
    type: 'color_background',
    options: {
      duration: section.duration,
      backgroundColor: section.color,
      ...(section.layers && section.layers.length > 0 ? { layers: section.layers } : {}),
      ...sectionAudioOptions(section),
    },
    ...visualExtras(section),
  };
}

// Round a fraction to 3 decimals, clamped to [0, 1] — keeps drawtext expressions tidy.
function roundFraction(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));

  return Math.round(clamped * 1000) / 1000;
}

type VideoSection = Extract<EditorSection, { kind: 'video' }>;
type StoredFilter = NonNullable<Section['filters']>[number];

// A drawtext filter for one overlay. Box keys are only added when the overlay
// opts into a background box; boxcolor carries the author-set opacity suffix.
function drawtextFilterFrom(overlay: TextOverlay): StoredFilter {
  return {
    type: 'drawtext',
    values: {
      text: { en: overlay.text },
      fontsize: overlay.fontsize,
      fontcolor: overlay.fontcolor,
      fontfile: findFont(overlay.font)?.file ?? 'Rubik.ttf',
      x: `(w-text_w)*${roundFraction(overlay.x)}`,
      y: `(h-text_h)*${roundFraction(overlay.y)}`,
      ...(overlay.box ? { box: 1, boxcolor: `${overlay.boxcolor}@${overlay.boxOpacity}`, boxborderw: 12 } : {}),
    },
  };
}

function videoDescriptorFrom(section: VideoSection, index: number): Section {
  const filters = section.overlays.filter((o) => o.text.trim() !== '').map(drawtextFilterFrom);
  const description = section.description?.trim();

  return {
    name: `video_${index}`,
    type: 'project_video',
    options: {
      duration: section.duration,
      muteSection: section.mute,
      ...(section.countdown ? { countdown: true, countdownDuration: section.countdownSeconds } : {}),
      ...(section.framingGuide ? { framingGuide: section.framingGuide } : {}),
      ...sectionAudioOptions(section),
    },
    // Recording instructions for the filmer, keyed under the app's default locale.
    // A blank/whitespace-only description emits nothing.
    ...(description ? { description: { [DEFAULT_LOCALE]: description } } : {}),
    ...(filters.length > 0 ? { filters } : {}),
    ...visualExtras(section),
  };
}

type IndexedSection = { section: EditorSection; index: number };

// One descriptor section for the given editor section. video/image sections are
// numbered with their own running counter (video_1…, image_1…) so uploaded files
// map to them; form/color use the overall descriptor position. music yields null.
function descriptorFor({ section, index }: IndexedSection): Section | null {
  if (section.kind === 'form') return formDescriptorFrom(section, index);

  if (section.kind === 'color') return colorDescriptorFrom(section, index);

  if (section.kind === 'video') return videoDescriptorFrom(section, index);

  if (section.kind === 'image') {
    return {
      name: `image_${index}`,
      type: 'image_background',
      options: { duration: section.duration, ...sectionAudioOptions(section) },
      ...visualExtras(section),
    };
  }

  return null;
}

// Descriptor sections, in editor order. music sections produce nothing here —
// they are folded into the global media fields.
function mapEditorSections(sections: EditorSection[]): Section[] {
  let videoIndex = 0;
  let imageIndex = 0;
  let descIndex = 0;

  const counted = sections.map((section): IndexedSection => {
    if (section.kind === 'video') return { section, index: (videoIndex += 1) };

    if (section.kind === 'image') return { section, index: (imageIndex += 1) };

    return { section, index: (descIndex += 1) };
  });

  return counted.map(descriptorFor).filter((s): s is Section => s !== null);
}

// music section -> global.allowed*/allowUpload*; image sections -> de-duplicated
// global.allowedBackgrounds union + allowUploadBackground (true if any allows it).
function mediaGlobals(sections: EditorSection[]): Partial<NonNullable<TemplateDescriptor['global']>> {
  const out: Partial<NonNullable<TemplateDescriptor['global']>> = {};

  const musicSection = sections.find((s): s is Extract<EditorSection, { kind: 'music' }> => s.kind === 'music');

  if (musicSection) {
    out.musicEnabled = true;
    out.allowedMusic = musicSection.allowed;
    out.allowUploadMusic = musicSection.allowUpload;
  }

  const imageSections = sections.filter((s): s is Extract<EditorSection, { kind: 'image' }> => s.kind === 'image');

  if (imageSections.length > 0) {
    out.allowedBackgrounds = [...new Set(imageSections.flatMap((s) => s.allowed))];
    out.allowUploadBackground = imageSections.some((s) => s.allowUpload);
  }

  return out;
}

// Author-defined global variables as a plain name -> value map, skipping any
// row with a blank name.
function authorVariables(globalVariables: EditorState['globalVariables']): Record<string, string> {
  return Object.fromEntries(globalVariables.filter((v) => v.name.trim() !== '').map((v) => [v.name, v.value]));
}

// editor audio mix -> global.audio, dropping normalize/ducking unless set/enabled.
function audioGlobal(audio: AudioMix): NonNullable<NonNullable<TemplateDescriptor['global']>['audio']> {
  return {
    sourceVolume: audio.sourceVolume,
    musicVolume: audio.musicVolume,
    ...(audio.normalize ? { normalize: audio.normalize } : {}),
    ...(audio.ducking ? { ducking: true } : {}),
  };
}

// Pure: editor state -> a core TemplateDescriptor.
export function buildDescriptor(state: EditorState): TemplateDescriptor {
  const global: NonNullable<TemplateDescriptor['global']> = {
    orientation: state.orientation,
    musicEnabled: false,
    transition: { type: state.defaultTransition.type, duration: state.defaultTransition.duration },
    // Audio mix: source (recorded clip) volume and background-music volume, each 0..1 (0 = muted).
    audio: audioGlobal(state.audio),
    ...mediaGlobals(state.sections),
  };

  const variables = authorVariables(state.globalVariables);

  if (Object.keys(variables).length > 0) {
    global.variables = { ...global.variables, ...variables };
  }

  return { global, sections: mapEditorSections(state.sections) };
}

// De-duplicated union of every variable name available to the editor: form
// field names (in section order) first, then non-empty author global names.
export function collectVariables(state: EditorState): string[] {
  const formFieldNames = state.sections
    .filter((s): s is Extract<EditorSection, { kind: 'form' }> => s.kind === 'form')
    .flatMap((s) => s.fields.map((f) => f.name));

  const globalNames = state.globalVariables.map((v) => v.name).filter((name) => name.trim() !== '');

  return [...new Set([...formFieldNames, ...globalNames])];
}
