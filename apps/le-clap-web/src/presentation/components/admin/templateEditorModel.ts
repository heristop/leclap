import type { Template } from '@/services/templateService';
import type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';
import { FONTS, findFont, DEFAULT_FONT_ID } from 'ffmpeg-video-composer/src/shared/library/fonts.ts';

export type MediaChoice = { source: 'library'; id: string } | { source: 'upload'; key: string; label: string };

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

export type EditorSection =
  | { kind: 'form'; fields: FormField[] }
  | { kind: 'video'; duration: number; mute: boolean; overlays: TextOverlay[] }
  | { kind: 'color'; duration: number; color: string }
  | { kind: 'music'; allowed: string[]; allowUpload: boolean }
  | { kind: 'image'; allowed: string[]; allowUpload: boolean; duration: number };

export interface EditorState {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  sections: EditorSection[];
  globalVariables: { name: string; value: string }[];
}

export const SECTION_LABELS: Record<EditorSection['kind'], string> = {
  form: 'Form fields',
  video: 'Your video',
  color: 'Color background',
  music: 'Background music',
  image: 'Background image',
};

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
function fontIdFromFile(file: string | undefined): string {
  return FONTS.find((f) => f.file === file)?.id ?? DEFAULT_FONT_ID;
}

export function newSection(kind: EditorSection['kind']): EditorSection {
  if (kind === 'form') return { kind: 'form', fields: [{ name: 'firstname', label: 'Your name', maxLength: 40 }] };

  if (kind === 'color') return { kind: 'color', duration: 3, color: '#7C83FD' };

  if (kind === 'music') return { kind: 'music', allowed: [], allowUpload: false };

  if (kind === 'image') return { kind: 'image', allowed: [], allowUpload: false, duration: 4 };

  return { kind: 'video', duration: 8, mute: false, overlays: [] };
}

function makeTemplateId(): string {
  try {
    const uuid = globalThis.crypto.randomUUID();

    return uuid ? `user-${uuid}` : `user-${Date.now()}`;
  } catch {
    return `user-${Date.now()}`;
  }
}

type StoredSection = NonNullable<TemplateDescriptor['sections']>[number];

function formDescriptorFrom(section: { kind: 'form'; fields: FormField[] }, index: number): StoredSection {
  return {
    name: `form_${index}`,
    type: 'form',
    options: {
      fields: section.fields.map((f) => ({ name: f.name, maxLength: f.maxLength, label: { en: f.label } })),
    },
  };
}

function colorDescriptorFrom(
  section: { kind: 'color'; duration: number; color: string },
  index: number
): StoredSection {
  return {
    name: `color_${index}`,
    type: 'color_background',
    options: { duration: section.duration, backgroundColor: section.color },
  };
}

// Round a fraction to 3 decimals, clamped to [0, 1] — keeps drawtext expressions tidy.
function roundFraction(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));

  return Math.round(clamped * 1000) / 1000;
}

type VideoSection = Extract<EditorSection, { kind: 'video' }>;
type StoredFilter = NonNullable<StoredSection['filters']>[number];

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

function videoDescriptorFrom(section: VideoSection, index: number): StoredSection {
  const filters = section.overlays.filter((o) => o.text.trim() !== '').map(drawtextFilterFrom);

  return {
    name: `video_${index}`,
    type: 'project_video',
    options: { duration: section.duration, muteSection: section.mute },
    ...(filters.length > 0 ? { filters } : {}),
  };
}

type IndexedSection = { section: EditorSection; index: number };

// One descriptor section for the given editor section. video/image sections are
// numbered with their own running counter (video_1…, image_1…) so uploaded files
// map to them; form/color use the overall descriptor position. music yields null.
function descriptorFor({ section, index }: IndexedSection): StoredSection | null {
  if (section.kind === 'form') return formDescriptorFrom(section, index);

  if (section.kind === 'color') return colorDescriptorFrom(section, index);

  if (section.kind === 'video') return videoDescriptorFrom(section, index);

  if (section.kind === 'image') {
    return { name: `image_${index}`, type: 'image_background', options: { duration: section.duration } };
  }

  return null;
}

// Descriptor sections, in editor order. music sections produce nothing here —
// they are folded into the global media fields.
function mapEditorSections(sections: EditorSection[]): StoredSection[] {
  let videoIndex = 0;
  let imageIndex = 0;
  let descIndex = 0;

  const counted = sections.map((section): IndexedSection => {
    if (section.kind === 'video') return { section, index: (videoIndex += 1) };

    if (section.kind === 'image') return { section, index: (imageIndex += 1) };

    return { section, index: (descIndex += 1) };
  });

  return counted.map(descriptorFor).filter((s): s is StoredSection => s !== null);
}

// music section -> global.allowed*/allowUpload*; image sections -> de-duplicated
// global.allowedBackgrounds union + allowUploadBackground (true if any allows it).
function mediaGlobals(sections: EditorSection[]): Partial<NonNullable<TemplateDescriptor['global']>> {
  const out: Partial<NonNullable<TemplateDescriptor['global']>> = {};

  const musicSection = sections.find((s) => s.kind === 'music');

  if (musicSection) {
    out.musicEnabled = true;
    out.allowedMusic = musicSection.allowed;
    out.allowUploadMusic = musicSection.allowUpload;
  }

  const imageSections = sections.filter((s) => s.kind === 'image');

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

// Pure: editor state -> a core TemplateDescriptor.
export function buildDescriptor(state: EditorState): TemplateDescriptor {
  const global: NonNullable<TemplateDescriptor['global']> = {
    orientation: state.orientation,
    musicEnabled: false,
    transitionDuration: 0.5,
    ...mediaGlobals(state.sections),
  };

  global.variables = { ...global.variables, ...authorVariables(state.globalVariables) };

  return { global, sections: mapEditorSections(state.sections) };
}

// De-duplicated union of every variable name available to the editor: form
// field names (in section order) first, then non-empty author global names.
export function collectVariables(state: EditorState): string[] {
  const formFieldNames = state.sections.filter((s) => s.kind === 'form').flatMap((s) => s.fields.map((f) => f.name));

  const globalNames = state.globalVariables.map((v) => v.name).filter((name) => name.trim() !== '');

  return [...new Set([...formFieldNames, ...globalNames])];
}

function formSectionFrom(s: StoredSection): EditorSection {
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

function colorSectionFrom(s: StoredSection): EditorSection {
  return { kind: 'color', duration: s.options?.duration ?? 3, color: s.options?.backgroundColor ?? '#7C83FD' };
}

// Best-effort recover the [0,1] position fraction from a stored drawtext x/y
// expression. Matches the `(w-text_w)*<frac>` / `(h-text_h)*<frac>` form this
// editor writes; the legacy `(…)/2` centered form (or anything unparseable)
// falls back to 0.5 (centered).
export function parseFraction(value?: string | number): number {
  if (typeof value !== 'string') return 0.5;

  const match = /\)\s*\*\s*(\d*\.?\d+)/.exec(value);

  if (!match) return 0.5;

  const fraction = Number(match[1]);

  if (!Number.isFinite(fraction)) return 0.5;

  return Math.min(1, Math.max(0, fraction));
}

type DrawtextValues = NonNullable<NonNullable<StoredSection['filters']>[number]['values']>;

// Drop any `@<opacity>` suffix the descriptor adds to a box color, recovering
// the bare hex the editor stores.
function stripOpacity(color: string | undefined): string {
  return (color ?? '#000000').split('@')[0];
}

// Recover the [0,1] box opacity from a stored `<hex>@<opacity>` boxcolor,
// defaulting to 0.5 when the suffix is absent or unparseable.
function parseOpacity(boxcolor: string | undefined): number {
  const match = /@(\d*\.?\d+)/.exec(boxcolor ?? '');

  if (!match) return 0.5;

  const value = Number(match[1]);

  if (!Number.isFinite(value)) return 0.5;

  return Math.min(1, Math.max(0, value));
}

function overlayFrom(dt: { values?: DrawtextValues }): TextOverlay {
  const v = dt.values;

  return {
    text: v?.text?.en ?? '',
    x: parseFraction(v?.x),
    y: parseFraction(v?.y),
    fontsize: Number(v?.fontsize ?? 48),
    fontcolor: v?.fontcolor ?? '#ffffff',
    font: fontIdFromFile(v?.fontfile),
    box: v?.box !== undefined,
    boxcolor: stripOpacity(v?.boxcolor),
    boxOpacity: parseOpacity(v?.boxcolor),
  };
}

function videoSectionFrom(s: StoredSection): EditorSection {
  const overlays = (s.filters ?? []).filter((f) => f.type === 'drawtext').map(overlayFrom);

  return {
    kind: 'video',
    duration: s.options?.duration ?? 8,
    mute: Boolean(s.options?.muteSection),
    overlays,
  };
}

function storedSectionToEditor(
  s: StoredSection,
  allowedBackgrounds: string[],
  allowUploadBackground: boolean
): EditorSection | null {
  if (s.type === 'form') return formSectionFrom(s);

  if (s.type === 'color_background') return colorSectionFrom(s);

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

// String entries of a descriptor's global.variables become editable author
// rows; string[] entries (e.g. colorsList-style vars) are skipped.
function globalVariablesFrom(global: TemplateDescriptor['global']): EditorState['globalVariables'] {
  return Object.entries(global?.variables ?? {})
    .filter(([, val]) => typeof val === 'string')
    .map(([name, value]) => ({ name, value: value as string }));
}

export function toEditorState(template: Template | null): EditorState {
  if (!template) {
    return {
      id: makeTemplateId(),
      name: '',
      description: '',
      orientation: 'landscape',
      sections: [newSection('video')],
      globalVariables: [],
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
    globalVariables: globalVariablesFrom(template.descriptor.global),
  };
}
