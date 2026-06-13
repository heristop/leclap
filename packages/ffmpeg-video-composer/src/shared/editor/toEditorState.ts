// Re-hydration: best-effort convert a stored TemplateDescriptor back to an EditorState.
import type { TemplateDescriptor, Section } from '../../core/types';
import {
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  newSection,
  makeTemplateId,
  fontIdFromFile,
  type EditorSection,
  type EditorState,
  type EditableTemplate,
  type TextOverlay,
  type SectionTransition,
  type AudioMix,
  type DefaultTransition,
  type Grade,
  type MotionEffect,
  type BackgroundLayer,
  type FramingGuide,
  type SectionAudioFade,
} from './model';

type DrawtextValues = NonNullable<NonNullable<Section['filters']>[number]['values']>;

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

// Recover the optional visual passthrough fields (transition/look/grade/motion) carried on a stored section.
function visualExtrasFrom(s: Section): {
  transitionAfter?: SectionTransition;
  look?: string;
  grade?: Grade;
  motion?: MotionEffect[];
} {
  return {
    ...(s.transition ? { transitionAfter: s.transition } : {}),
    ...(s.look ? { look: s.look } : {}),
    ...(s.grade ? { grade: s.grade as Grade } : {}),
    ...(s.motion && s.motion.length > 0 ? { motion: s.motion as MotionEffect[] } : {}),
  };
}

// Recover per-section audio extras (musicVolume / audioFade) from stored options.
function sectionAudioExtrasFrom(s: Section): { musicVolume?: number; audioFade?: SectionAudioFade } {
  const mv = s.options?.musicVolume;
  const af = s.options?.audioFade as SectionAudioFade | undefined;

  return {
    ...(mv === undefined ? {} : { musicVolume: mv }),
    ...(af ? { audioFade: af } : {}),
  };
}

function colorSectionFrom(s: Section): EditorSection {
  const layers = s.options?.layers as BackgroundLayer[] | undefined;

  return {
    kind: 'color',
    duration: s.options?.duration ?? 3,
    color: s.options?.backgroundColor ?? '#7C83FD',
    ...(layers && layers.length > 0 ? { layers } : {}),
    ...sectionAudioExtrasFrom(s),
    ...visualExtrasFrom(s),
  };
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
  const v = dt.values ?? {};
  const boxcolor = v.boxcolor;

  return {
    text: v.text?.en ?? '',
    x: parseFraction(v.x),
    y: parseFraction(v.y),
    fontsize: Number(v.fontsize ?? 48),
    fontcolor: v.fontcolor ?? '#ffffff',
    font: fontIdFromFile(v.fontfile),
    box: v.box !== undefined,
    boxcolor: stripOpacity(boxcolor),
    boxOpacity: parseOpacity(boxcolor),
  };
}

// Recover a section description: the default-locale ('en') string, else the first
// translation present, else undefined (so an absent/empty description stays empty).
function descriptionFrom(s: Section): string | undefined {
  const translation = s.description;

  if (!translation) return undefined;

  return translation.en ?? Object.values(translation)[0];
}

function videoSectionFrom(s: Section): EditorSection {
  const overlays = (s.filters ?? []).filter((f) => f.type === 'drawtext').map(overlayFrom);
  const framingGuide = s.options?.framingGuide as FramingGuide | undefined;
  const description = descriptionFrom(s);

  return {
    kind: 'video',
    duration: s.options?.duration ?? 8,
    mute: Boolean(s.options?.muteSection),
    overlays,
    ...(description ? { description } : {}),
    countdown: Boolean(s.options?.countdown),
    countdownSeconds: s.options?.countdownDuration ?? 4,
    // A stored countdown is treated as an explicit author choice, so re-opening a
    // template never silently re-syncs it to the clip duration.
    countdownCustomized: true,
    ...(framingGuide ? { framingGuide } : {}),
    ...sectionAudioExtrasFrom(s),
    ...visualExtrasFrom(s),
  };
}

function storedSectionToEditor(
  s: Section,
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
      ...sectionAudioExtrasFrom(s),
      ...visualExtrasFrom(s),
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

function audioFrom(global: TemplateDescriptor['global']): AudioMix {
  const a = global?.audio;

  return {
    sourceVolume: a?.sourceVolume ?? DEFAULT_AUDIO_MIX.sourceVolume,
    musicVolume: a?.musicVolume ?? DEFAULT_AUDIO_MIX.musicVolume,
    ...(a?.normalize ? { normalize: a.normalize } : {}),
    ducking: Boolean(a?.ducking),
  };
}

function defaultTransitionFrom(global: TemplateDescriptor['global']): DefaultTransition {
  const t = global?.transition;

  return {
    type: t?.type ?? DEFAULT_TRANSITION.type,
    duration: t?.duration ?? DEFAULT_TRANSITION.duration,
  };
}

// Music has no positional descriptor section — surface it at the top of the list.
function musicSectionsFrom(global: TemplateDescriptor['global']): EditorSection[] {
  const allowed = global?.allowedMusic ?? [];
  const allowUpload = Boolean(global?.allowUploadMusic);

  if (allowed.length === 0 && !allowUpload) return [];

  return [{ kind: 'music', allowed, allowUpload }];
}

function editorSectionsFrom(descriptor: TemplateDescriptor): EditorSection[] {
  const { global: g, sections: storedSections = [] } = descriptor;

  const allowedBackgrounds = g?.allowedBackgrounds ?? [];
  const allowUploadBackground = Boolean(g?.allowUploadBackground);

  const positional = storedSections
    .map((s) => storedSectionToEditor(s, allowedBackgrounds, allowUploadBackground))
    .filter((s): s is EditorSection => s !== null);

  const sections = [...musicSectionsFrom(g), ...positional];

  return sections.length > 0 ? sections : [newSection('video')];
}

export function toEditorState(template: EditableTemplate | null): EditorState {
  if (!template) {
    return {
      id: makeTemplateId(),
      name: '',
      description: '',
      orientation: 'landscape',
      sections: [newSection('video')],
      globalVariables: [],
      audio: { ...DEFAULT_AUDIO_MIX },
      defaultTransition: { ...DEFAULT_TRANSITION },
    };
  }

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    orientation: template.orientation,
    sections: editorSectionsFrom(template.descriptor),
    globalVariables: globalVariablesFrom(template.descriptor.global),
    audio: audioFrom(template.descriptor.global),
    defaultTransition: defaultTransitionFrom(template.descriptor.global),
  };
}
