// Pure: editor state -> core TemplateDescriptor. All helpers are file-local.
import type { TemplateDescriptor, Section } from 'ffmpeg-video-composer/src/core/types.d.ts';
import { findFont } from '../fonts';
import type {
  EditorSection,
  EditorState,
  FormField,
  TextOverlay,
  SectionTransition,
  AudioMix,
  Grade,
  MotionEffect,
  ChromaKey,
  EditorCaption,
  AnimationOverlay,
  ImageOverlay,
  MediaChoice,
} from './model';

// Default authoring locale for Translation fields the editor emits (section descriptions,
// overlay/form text all key under 'en'). Single source so future i18n has one place to change.
const DEFAULT_LOCALE = 'en';

// Drop keys that are undefined or empty-string so the descriptor only carries fields the author
// actually set, while keeping meaningful 0 / false values (e.g. fontsize 0, box false).
function pruneEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}

// Common visual-section passthrough fields (transition + grading + motion), only emitted when set.
function captionDescriptorFrom(caption: EditorCaption | undefined): Section['caption'] | undefined {
  const text = caption?.text.trim();

  if (!caption || !text) return undefined;

  return pruneEmpty({
    text: { ...caption.textI18n, [DEFAULT_LOCALE]: text },
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
  }) as Section['caption'];
}

// The playback extent — exactly one of duration / loops / loop (precedence duration > loops > loop).
// Emitting only the active one keeps the descriptor unambiguous and minimal.
function animationExtent(a: AnimationOverlay) {
  if (a.duration !== undefined) return { duration: a.duration };

  if (a.loops !== undefined) return { loops: a.loops };

  return { loop: a.loop ?? true };
}

// Placement/playback options shared by a section animation input and a whole-video global animation:
// extent (duration | loops | loop), persistent, start, position/scale; opacity only when it fades (< 1),
// rotation only when nonzero, motion when set — so opaque/upright/static overlays stay clean.
function animationOptions(animation: AnimationOverlay) {
  return {
    ...animationExtent(animation),
    persistent: animation.persistent ?? true,
    ...(animation.start ? { start: animation.start } : {}),
    ...(animation.position ? { position: animation.position } : {}),
    ...(animation.scale ? { scale: animation.scale } : {}),
    ...(animation.opacity !== undefined && animation.opacity < 1 ? { opacity: animation.opacity } : {}),
    ...(animation.rotation ? { rotation: animation.rotation } : {}),
    ...(animation.motion ? { motion: animation.motion } : {}),
  };
}

// A looping animated overlay → a single `type: 'animation'` input the core auto-composites over the section.
function animationInputFrom(animation: AnimationOverlay, index: number): NonNullable<Section['inputs']>[number] {
  return { name: `animation_${index}`, url: animation.url, type: 'animation', options: animationOptions(animation) };
}

// A whole-video overlay → one global.animations entry (url + flattened options). Composited over the
// final joined video by the engine's AnimationComposer, spanning every section.
function globalAnimationFrom(
  animation: AnimationOverlay
): NonNullable<NonNullable<TemplateDescriptor['global']>['animations']>[number] {
  return { url: animation.url, ...animationOptions(animation) };
}

// The author's animated overlays → `type: 'animation'` inputs named `animation_<i>` by array order.
// Entries without a url (a half-filled picker) are skipped.
function animationInputsFrom(animations: AnimationOverlay[] | undefined): NonNullable<Section['inputs']> {
  return (animations ?? []).filter((a) => a.url).map((a, i) => animationInputFrom(a, i));
}

// A MediaChoice → the marker url the descriptor carries: library → `library://<id>`, upload →
// `media://<key>` (materialized into the engine FS at compile), url → the pasted url as-is.
function markerFromChoice(choice: MediaChoice): string {
  if (choice.source === 'library') return `library://${choice.id}`;

  if (choice.source === 'upload') return `media://${choice.key}`;

  return choice.url;
}

// A still-image overlay → a `type: 'image'` input composited via the same overlay path as animations.
// Named `image_<i>` by array position. position/scale/opacity(<1)/rotation(≠0) pass through when set.
function imageInputFrom(overlay: ImageOverlay, index: number): NonNullable<Section['inputs']>[number] {
  const options = {
    ...(overlay.position ? { position: overlay.position } : {}),
    ...(overlay.scale ? { scale: overlay.scale } : {}),
    ...(overlay.opacity !== undefined && overlay.opacity < 1 ? { opacity: overlay.opacity } : {}),
    ...(overlay.rotation ? { rotation: overlay.rotation } : {}),
  };

  return { name: `image_${index}`, url: markerFromChoice(overlay.choice), type: 'image', options };
}

// Animations + image overlays composited over a visual section, in z-order: animations first (array
// order), then images on top (array order). Spread AFTER visualExtras to override its animation-only
// `inputs`. Shared by video / color / image sections so each composites its overlays identically.
function overlayInputsFrom(section: {
  animations?: AnimationOverlay[];
  images?: ImageOverlay[];
}): NonNullable<Section['inputs']> {
  return [
    ...animationInputsFrom(section.animations),
    ...(section.images ?? []).map((image, i) => imageInputFrom(image, i)),
  ];
}

function visualExtras(section: {
  transitionAfter?: SectionTransition;
  caption?: EditorCaption;
  look?: string;
  grade?: Grade;
  motion?: MotionEffect[];
  chromaKey?: ChromaKey;
  animations?: AnimationOverlay[];
}): Partial<Section> {
  const caption = captionDescriptorFrom(section.caption);
  const animationInputs = animationInputsFrom(section.animations);

  return {
    ...(section.transitionAfter ? { transition: section.transitionAfter } : {}),
    ...(caption ? { caption } : {}),
    ...(section.look ? { look: section.look } : {}),
    ...(section.grade ? { grade: section.grade } : {}),
    ...(section.motion && section.motion.length > 0 ? { motion: section.motion } : {}),
    ...(section.chromaKey ? { chromaKey: section.chromaKey } : {}),
    ...(animationInputs.length > 0 ? { inputs: animationInputs } : {}),
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

type PartialEditorSection = Extract<EditorSection, { kind: 'partial' }>;
type DescriptorSection = NonNullable<TemplateDescriptor['sections']>[number];
type PartialDescriptor = Extract<DescriptorSection, { type: 'partial' }>;

function partialDescriptorFrom(section: PartialEditorSection, index: number): PartialDescriptor {
  const prefix = section.prefix?.trim();
  const variables = Object.fromEntries(
    section.variables
      .filter((variable) => variable.name.trim() !== '')
      .map((variable) => [variable.name, variable.value])
  );

  return {
    name: `partial_${index}`,
    type: 'partial',
    ref: section.ref,
    ...(prefix ? { prefix } : {}),
    ...(Object.keys(variables).length > 0 ? { variables } : {}),
  };
}

type ColorSection = Extract<EditorSection, { kind: 'color' }>;

function colorDescriptorFrom(section: ColorSection, index: number): Section {
  const filters = overlayFiltersFrom(section.overlays);
  const overlayInputs = overlayInputsFrom(section);

  return {
    name: `color_${index}`,
    type: 'color_background',
    options: {
      duration: section.duration,
      backgroundColor: section.color,
      ...(section.layers && section.layers.length > 0 ? { layers: section.layers } : {}),
      ...sectionAudioOptions(section),
    },
    ...(section.titleCard ? { titleCard: section.titleCard as Section['titleCard'] } : {}),
    ...(filters.length > 0 ? { filters } : {}),
    ...visualExtras(section),
    ...(overlayInputs.length > 0 ? { inputs: overlayInputs } : {}),
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

// Non-empty text overlays → drawtext filters, in author order. Shared by video/color/image sections;
// tolerant of an absent list (older states / sections built before overlays existed on this kind).
function overlayFiltersFrom(overlays: TextOverlay[] | undefined): StoredFilter[] {
  return (overlays ?? []).filter((o) => o.text.trim() !== '').map(drawtextFilterFrom);
}

function videoDescriptorFrom(section: VideoSection, index: number): Section {
  const filters = overlayFiltersFrom(section.overlays);
  const description = section.description?.trim();
  const overlayInputs = overlayInputsFrom(section);

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
    ...(section.lowerThird ? { lowerThird: section.lowerThird as Section['lowerThird'] } : {}),
    ...(filters.length > 0 ? { filters } : {}),
    ...visualExtras(section),
    ...(overlayInputs.length > 0 ? { inputs: overlayInputs } : {}),
  };
}

type IndexedSection = { section: EditorSection; index: number };

// One descriptor section for the given editor section. video/image sections are
// numbered with their own running counter (video_1…, image_1…) so uploaded files
// map to them; form/color use the overall descriptor position. music yields null.
function descriptorFor({ section, index }: IndexedSection): DescriptorSection | null {
  if (section.kind === 'form') return formDescriptorFrom(section, index);

  if (section.kind === 'partial') return partialDescriptorFrom(section, index);

  if (section.kind === 'color') return colorDescriptorFrom(section, index);

  if (section.kind === 'video') return videoDescriptorFrom(section, index);

  if (section.kind === 'image') {
    const filters = overlayFiltersFrom(section.overlays);
    const overlayInputs = overlayInputsFrom(section);

    return {
      name: `image_${index}`,
      type: 'image_background',
      options: { duration: section.duration, ...sectionAudioOptions(section) },
      ...(filters.length > 0 ? { filters } : {}),
      ...visualExtras(section),
      ...(overlayInputs.length > 0 ? { inputs: overlayInputs } : {}),
    };
  }

  return null;
}

// Descriptor sections, in editor order. music sections produce nothing here —
// they are folded into the global media fields.
function mapEditorSections(sections: EditorSection[]): DescriptorSection[] {
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

type GlobalOverlay = NonNullable<NonNullable<TemplateDescriptor['global']>['overlays']>[number];

// Whole-video text overlays, dropping any blank row the builder leaves behind so the descriptor only
// carries real overlays. Emits nothing when none remain.
function globalOverlaysField(
  overlays: EditorState['globalOverlays']
): Partial<NonNullable<TemplateDescriptor['global']>> {
  const kept = overlays.filter((o) => Object.values(o.text).some((value) => value.trim() !== ''));

  return kept.length > 0 ? { overlays: kept as GlobalOverlay[] } : {};
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
    ...(state.globalAnimations.length > 0 ? { animations: state.globalAnimations.map(globalAnimationFrom) } : {}),
    // Whole-video text overlays (brand watermark, etc.) authored once and composited onto every section.
    ...globalOverlaysField(state.globalOverlays),
    ...(state.globalLook ? { look: state.globalLook } : {}),
    ...(state.globalGrade ? { grade: state.globalGrade } : {}),
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
