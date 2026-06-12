import type { TemplateDescriptor, Section } from '@/src/types';

// --- Editor-friendly section model (flattened; compiled to a descriptor on save) ---
// Mirrors leclap-web's templateEditorModel exactly: background music + background
// image are SECTIONS (peers of video/form/color), each carrying a curated multi-select
// shortlist + an "allow upload" flag (image also a duration).

export type FormField = { name: string; label: string; maxLength: number };

export type EditorSection =
  | { kind: 'form'; fields: FormField[] }
  | {
      kind: 'video';
      duration: number;
      mute: boolean;
      text: string;
      fontsize: number;
      fontcolor: string;
      countdown: boolean;
      countdownSeconds: number;
    }
  | { kind: 'color'; duration: number; color: string }
  | { kind: 'music'; allowed: string[]; allowUpload: boolean }
  | { kind: 'image'; allowed: string[]; allowUpload: boolean; duration: number };

export type Orientation = 'landscape' | 'portrait';

// Global audio mix: the recorded clips' own audio vs the background music, each 0..1. 0 = muted.
export interface AudioMix {
  video: number;
  music: number;
}

export const DEFAULT_AUDIO_MIX: AudioMix = { video: 1, music: 0.5 };

export interface EditorState {
  id: string;
  name: string;
  description: string;
  orientation: Orientation;
  sections: EditorSection[];
  audioMix: AudioMix;
}

/** Minimal shape needed to re-hydrate the editor from a saved custom template. */
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

export function newSection(kind: EditorSection['kind']): EditorSection {
  if (kind === 'form') {
    return { kind: 'form', fields: [{ name: 'firstname', label: 'Your name', maxLength: 40 }] };
  }

  if (kind === 'color') {
    return { kind: 'color', duration: 3, color: '#7C83FD' };
  }

  if (kind === 'music') {
    return { kind: 'music', allowed: [], allowUpload: false };
  }

  if (kind === 'image') {
    return { kind: 'image', allowed: [], allowUpload: false, duration: 4 };
  }

  return {
    kind: 'video',
    duration: 8,
    mute: false,
    text: '',
    fontsize: 48,
    fontcolor: '#ffffff',
    countdown: false,
    countdownSeconds: 4,
  };
}

/** Stable id for a user template. Uses crypto.randomUUID when available (rare on Hermes). */
export function makeTemplateId(): string {
  try {
    // Typed as optional: the DOM lib guarantees crypto.randomUUID, but Hermes (RN) may not have it.
    const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    const uuid = webCrypto?.randomUUID?.();

    if (uuid) {
      return `user-${uuid}`;
    }
  } catch {
    // fall through to timestamp-based id
  }

  return `user-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

// --- descriptor section builders (one per editor section kind that has a positional descriptor) ---

function formDescriptorFrom(section: { kind: 'form'; fields: FormField[] }, index: number): Section {
  return {
    name: `form_${index}`,
    type: 'form',
    options: {
      fields: section.fields.map((f) => ({ name: f.name, maxLength: f.maxLength, label: { en: f.label } })),
    },
  };
}

function colorDescriptorFrom(section: { kind: 'color'; duration: number; color: string }, index: number): Section {
  return {
    name: `color_${index}`,
    type: 'color_background',
    options: { duration: section.duration, backgroundColor: section.color },
  };
}

function videoDescriptorFrom(section: Extract<EditorSection, { kind: 'video' }>, index: number): Section {
  const filters = section.text.trim()
    ? [
        {
          type: 'drawtext',
          values: {
            text: { en: section.text },
            fontsize: section.fontsize,
            fontcolor: section.fontcolor,
            fontfile: 'Rubik.ttf',
            x: '(w-text_w)/2',
            y: '(h-text_h)/2',
          },
        },
      ]
    : undefined;

  return {
    name: `video_${index}`,
    type: 'project_video',
    options: {
      duration: section.duration,
      muteSection: section.mute,
      ...(section.countdown ? { countdown: true, countdownDuration: section.countdownSeconds } : {}),
    },
    ...(filters ? { filters } : {}),
  };
}

type IndexedSection = { section: EditorSection; index: number };

// One descriptor section for the given editor section. video/image sections are
// numbered with their own running counter (video_1…, image_1…) so uploaded files
// map to them; form/color use the overall descriptor position. music yields null.
function descriptorFor({ section, index }: IndexedSection): Section | null {
  if (section.kind === 'form') {
    return formDescriptorFrom(section, index);
  }

  if (section.kind === 'color') {
    return colorDescriptorFrom(section, index);
  }

  if (section.kind === 'video') {
    return videoDescriptorFrom(section, index);
  }

  if (section.kind === 'image') {
    return { name: `image_${index}`, type: 'image_background', options: { duration: section.duration } };
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
    if (section.kind === 'video') {
      videoIndex += 1;

      return { section, index: videoIndex };
    }

    if (section.kind === 'image') {
      imageIndex += 1;

      return { section, index: imageIndex };
    }

    descIndex += 1;

    return { section, index: descIndex };
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

/**
 * Pure: editor state -> a core TemplateDescriptor. project_video sections are
 * numbered video_1, video_2… so recorded clips (userVideoPaths keys) map to them.
 * Mirrors the web model exactly: a music section folds into global media fields
 * (no own descriptor section); each image section becomes one image_background
 * descriptor section + contributes to global.allowedBackgrounds/allowUploadBackground.
 */
export function buildDescriptor(state: EditorState): TemplateDescriptor {
  const global: NonNullable<TemplateDescriptor['global']> = {
    orientation: state.orientation,
    musicEnabled: false,
    transitionDuration: 0.5,
    // Audio mix: video (recorded clip) volume and background-music volume, each 0..1 (0 = muted).
    audioVolumeLevel: state.audioMix.video,
    musicVolumeLevel: state.audioMix.music,
    ...mediaGlobals(state.sections),
  };

  return { global, sections: mapEditorSections(state.sections) };
}

// --- re-hydration (best-effort for the bounded set of section kinds) ---

type DrawtextFilter = {
  type: string;
  values?: { text?: Record<string, string>; fontsize?: number | string; fontcolor?: string };
};

function formSectionFrom(s: Section): EditorSection {
  const fields = (s.options?.fields ?? []) as Array<{
    name: string;
    maxLength?: number;
    label?: Record<string, string>;
  }>;

  return {
    kind: 'form',
    fields: fields.map((f) => ({ name: f.name, label: f.label?.en ?? f.name, maxLength: f.maxLength ?? 40 })),
  };
}

function colorSectionFrom(s: Section): EditorSection {
  return { kind: 'color', duration: s.options?.duration ?? 3, color: s.options?.backgroundColor ?? '#7C83FD' };
}

function drawtextValuesFrom(s: Section): DrawtextFilter['values'] {
  const dt = ((s.filters ?? []) as DrawtextFilter[]).find((f) => f.type === 'drawtext');

  return dt?.values;
}

function videoSectionFrom(s: Section): EditorSection {
  const v = drawtextValuesFrom(s) ?? {};
  const o = s.options ?? {};

  return {
    kind: 'video',
    duration: o.duration ?? 8,
    mute: Boolean(o.muteSection),
    text: v.text?.en ?? '',
    fontsize: Number(v.fontsize ?? 48),
    fontcolor: v.fontcolor ?? '#ffffff',
    countdown: Boolean(o.countdown),
    countdownSeconds: o.countdownDuration ?? 4,
  };
}

function storedSectionToEditor(
  s: Section,
  allowedBackgrounds: string[],
  allowUploadBackground: boolean
): EditorSection | null {
  if (s.type === 'form') {
    return formSectionFrom(s);
  }

  if (s.type === 'color_background') {
    return colorSectionFrom(s);
  }

  if (s.type === 'image_background') {
    return {
      kind: 'image',
      allowed: allowedBackgrounds,
      allowUpload: allowUploadBackground,
      duration: s.options?.duration ?? 4,
    };
  }

  return videoSectionFrom(s);
}

export function toEditorState(template: EditableTemplate | null): EditorState {
  if (!template) {
    return {
      id: makeTemplateId(),
      name: '',
      description: '',
      orientation: 'landscape',
      sections: [newSection('video')],
      audioMix: { ...DEFAULT_AUDIO_MIX },
    };
  }

  const { global: g, sections: storedSections = [] } = template.descriptor;

  const allowedMusic = g?.allowedMusic ?? [];
  const allowUploadMusic = Boolean(g?.allowUploadMusic);
  const hasMusic = allowedMusic.length > 0 || allowUploadMusic;

  const allowedBackgrounds = g?.allowedBackgrounds ?? [];
  const allowUploadBackground = Boolean(g?.allowUploadBackground);

  const positional = storedSections
    .map((s) => storedSectionToEditor(s, allowedBackgrounds, allowUploadBackground))
    .filter((s): s is EditorSection => s !== null);

  // Music has no positional descriptor section — surface it at the top of the list.
  const musicSections: EditorSection[] = hasMusic
    ? [{ kind: 'music', allowed: allowedMusic, allowUpload: allowUploadMusic }]
    : [];

  const sections = [...musicSections, ...positional];

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    orientation: template.orientation,
    sections: sections.length > 0 ? sections : [newSection('video')],
    audioMix: {
      video: g?.audioVolumeLevel ?? DEFAULT_AUDIO_MIX.video,
      music: g?.musicVolumeLevel ?? DEFAULT_AUDIO_MIX.music,
    },
  };
}
