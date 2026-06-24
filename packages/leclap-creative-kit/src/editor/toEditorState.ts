// Re-hydration: best-effort convert a stored TemplateDescriptor back to an EditorState.
import type {
  TemplateDescriptor,
  Section,
  PartialSection,
  GlobalAnimation,
} from 'ffmpeg-video-composer/src/core/types.d.ts';
import {
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  newSection,
  makeTemplateId,
  type EditorSection,
  type EditorState,
  type EditableTemplate,
  type SectionTransition,
  type AudioMix,
  type DefaultTransition,
  type Grade,
  type MotionEffect,
  type BackgroundLayer,
  type FramingGuide,
  type SectionAudioFade,
  type EditorCaption,
  type AnimationOverlay,
  type ImageOverlay,
  type MediaChoice,
  type TitleCard,
  type LowerThird,
  type GlobalTextOverlay,
  type ChromaKey,
} from './model';
import { overlayFrom } from './overlayParsing';

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

type StoredDescriptorSection = NonNullable<TemplateDescriptor['sections']>[number];

function isPartialSection(s: StoredDescriptorSection): s is PartialSection {
  return s.type === 'partial';
}

function partialSectionFrom(s: PartialSection): EditorSection {
  return {
    kind: 'partial',
    ref: s.ref ?? '',
    variables: Object.entries(s.variables ?? {}).map(([name, value]) => ({ name, value })),
    ...(s.prefix ? { prefix: s.prefix } : {}),
  };
}

// Drop keys that are undefined or empty-string so a re-hydrated caption only carries fields the
// stored section actually set, while keeping meaningful 0 / false values (e.g. fontsize 0, box false).
function pruneEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}

// Recover an editor caption from a stored section's `caption`, resolving its localized text.
function captionFrom(s: Section): EditorCaption | undefined {
  const caption = s.caption;
  const text = caption?.text.en ?? Object.values(caption?.text ?? {}).find(Boolean);

  if (!caption || !text) return undefined;

  return pruneEmpty({
    text,
    textI18n: caption.text,
    position: caption.position,
    style: caption.style,
    align: caption.align,
    font: caption.font,
    fontsize: caption.fontsize,
    color: caption.color,
    box: caption.box,
    boxColor: caption.boxColor,
    boxOpacity: caption.boxOpacity,
    reveal: caption.reveal,
    effect: caption.effect,
  }) as EditorCaption;
}

// Recover the animation overlays from the section's `type: 'animation'` inputs, in stored order. The
// editor-only `id` is derived from the input name so re-hydration is deterministic.
function animationsFrom(s: Section): AnimationOverlay[] {
  return (s.inputs ?? [])
    .filter((i) => i.type === 'animation' && i.url)
    .map((input) => {
      return { id: input.name, url: input.url as string, ...overlayOptionsFrom(input.options ?? {}) };
    });
}

// Recover editor-facing overlay options (placement + playback) from a stored animation, carrying
// only explicit non-defaults. Active extent = whichever of duration / loops / loop:false is set.
function overlayOptionsFrom(o: Partial<GlobalAnimation>): Omit<AnimationOverlay, 'id' | 'url' | 'label'> {
  return {
    ...(o.duration === undefined ? {} : { duration: o.duration }),
    ...(o.loops === undefined ? {} : { loops: o.loops }),
    ...(o.loop === false ? { loop: false } : {}),
    ...(o.position ? { position: o.position } : {}),
    ...(o.scale ? { scale: o.scale } : {}),
    ...(o.start ? { start: o.start } : {}),
    ...(o.persistent === false ? { persistent: false } : {}),
    ...(o.opacity !== undefined && o.opacity < 1 ? { opacity: o.opacity } : {}),
    ...(o.rotation ? { rotation: o.rotation } : {}),
    ...(o.motion ? { motion: o.motion } : {}),
  };
}

// Reverse markerFromChoice (buildDescriptor): the input url marker → a MediaChoice. `media://` uploads
// lose their human label across the descriptor, so fall back to the key as the display label.
function choiceFromMarker(url: string): MediaChoice {
  if (url.startsWith('library://')) return { source: 'library', id: url.slice('library://'.length) };

  if (url.startsWith('media://')) {
    const key = url.slice('media://'.length);

    return { source: 'upload', key, label: key };
  }

  return { source: 'url', url };
}

// Recover the still-image overlays from the section's `type: 'image'` inputs, in their stored order.
// The editor-only `id` is derived from the input name so re-hydration is deterministic.
function imagesFrom(s: Section): ImageOverlay[] {
  return (s.inputs ?? [])
    .filter((i) => i.type === 'image' && i.url)
    .map((input) => {
      const { position, scale, opacity, rotation } = input.options ?? {};

      // opacity defaults to opaque, so only carry an explicit fade (< 1) back, mirroring animationsFrom.
      return {
        id: input.name,
        choice: choiceFromMarker(input.url as string),
        ...(position ? { position } : {}),
        ...(scale ? { scale } : {}),
        ...(opacity !== undefined && opacity < 1 ? { opacity } : {}),
        ...(rotation ? { rotation } : {}),
      };
    });
}

type VisualExtras = {
  transitionAfter?: SectionTransition;
  caption?: EditorCaption;
  look?: string;
  grade?: Grade;
  motion?: MotionEffect[];
  animations?: AnimationOverlay[];
};

function visualExtrasFrom(s: Section): VisualExtras {
  const caption = captionFrom(s);
  const animations = animationsFrom(s);

  return {
    ...(s.transition ? { transitionAfter: s.transition } : {}),
    ...(caption ? { caption } : {}),
    ...(s.look ? { look: s.look } : {}),
    ...(s.grade ? { grade: s.grade as Grade } : {}),
    ...(s.motion && s.motion.length > 0 ? { motion: s.motion as MotionEffect[] } : {}),
    ...(animations.length > 0 ? { animations } : {}),
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
  const layers = (s.options?.layers ?? []) as BackgroundLayer[];
  const images = imagesFrom(s);

  return {
    kind: 'color',
    duration: s.options?.duration ?? 3,
    color: s.options?.backgroundColor ?? '#7C83FD',
    ...(layers.length > 0 ? { layers } : {}),
    ...(images.length > 0 ? { images } : {}),
    ...(s.titleCard ? { titleCard: s.titleCard as TitleCard } : {}),
    overlays: (s.filters ?? []).filter((f) => f.type === 'drawtext').map(overlayFrom),
    ...sectionAudioExtrasFrom(s),
    ...visualExtrasFrom(s),
  };
}

// Recover a section description: 'en' string, else first translation, else undefined.
function descriptionFrom(s: Section): string | undefined {
  if (!s.description) return undefined;

  return s.description.en ?? Object.values(s.description)[0];
}

// The video-only extras (framing guide + lower third), only present when stored — extracted so
// videoSectionFrom stays within the complexity budget.
function videoExtrasFrom(s: Section): { framingGuide?: FramingGuide; lowerThird?: LowerThird; chromaKey?: ChromaKey } {
  const framingGuide = s.options?.framingGuide as FramingGuide | undefined;

  return {
    ...(framingGuide ? { framingGuide } : {}),
    ...(s.lowerThird ? { lowerThird: s.lowerThird as LowerThird } : {}),
    ...(s.chromaKey ? { chromaKey: s.chromaKey as ChromaKey } : {}),
  };
}

function videoSectionFrom(s: Section): EditorSection {
  const description = descriptionFrom(s);
  const images = imagesFrom(s);

  return {
    kind: 'video',
    ...(images.length > 0 ? { images } : {}),
    duration: s.options?.duration ?? 8,
    mute: Boolean(s.options?.muteSection),
    overlays: (s.filters ?? []).filter((f) => f.type === 'drawtext').map(overlayFrom),
    ...(description ? { description } : {}),
    countdown: Boolean(s.options?.countdown),
    countdownSeconds: s.options?.countdownDuration ?? 4,
    // A stored countdown is an explicit author choice, so re-opening never re-syncs it to clip duration.
    countdownCustomized: true,
    ...videoExtrasFrom(s),
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
    const images = imagesFrom(s);

    return {
      kind: 'image',
      allowed: allowedBackgrounds,
      allowUpload: allowUploadBackground,
      duration: s.options?.duration ?? 4,
      ...(images.length > 0 ? { images } : {}),
      overlays: (s.filters ?? []).filter((f) => f.type === 'drawtext').map(overlayFrom),
      ...sectionAudioExtrasFrom(s),
      ...visualExtrasFrom(s),
    };
  }

  return videoSectionFrom(s);
}

function isRenderableSection(s: NonNullable<TemplateDescriptor['sections']>[number]): s is Section {
  return s.type !== 'partial' && typeof s.name === 'string';
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
  return {
    type: global?.transition?.type ?? DEFAULT_TRANSITION.type,
    duration: global?.transition?.duration ?? DEFAULT_TRANSITION.duration,
  };
}

// Recover whole-video overlays from global.animations, carrying only explicit non-default options back
// (loop/persistent default true; opacity defaults opaque; rotation defaults upright), like animationsFrom.
function globalAnimationsFrom(global: TemplateDescriptor['global']): AnimationOverlay[] {
  return (global?.animations ?? []).map((animation, index) => ({
    id: `global_animation_${index}`,
    url: animation.url,
    ...overlayOptionsFrom(animation),
  }));
}

// Recover whole-video text overlays (global.overlays) — stored in the descriptor shape, so they map back unchanged.
function globalOverlaysFrom(global: TemplateDescriptor['global']): GlobalTextOverlay[] {
  return (global?.overlays ?? []) as GlobalTextOverlay[];
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
    .map((s) => {
      if (isPartialSection(s)) return partialSectionFrom(s);

      if (isRenderableSection(s)) return storedSectionToEditor(s, allowedBackgrounds, allowUploadBackground);

      return null;
    })
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
      globalAnimations: [],
      globalOverlays: [],
    };
  }

  const global = template.descriptor.global;

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    orientation: template.orientation,
    sections: editorSectionsFrom(template.descriptor),
    globalVariables: globalVariablesFrom(global),
    audio: audioFrom(global),
    defaultTransition: defaultTransitionFrom(global),
    globalAnimations: globalAnimationsFrom(global),
    globalOverlays: globalOverlaysFrom(global),
    ...(global?.look ? { globalLook: global.look } : {}),
    ...(global?.grade ? { globalGrade: global.grade as EditorState['globalGrade'] } : {}),
  };
}
