// Pure: editor state -> core TemplateDescriptor. All helpers are file-local.
import type { TemplateDescriptor, Section } from 'ffmpeg-video-composer/src/core/types.d.ts';
import type {
  EditorSection,
  EditorState,
  FormField,
  SectionTransition,
  AudioMix,
  Grade,
  MotionEffect,
  ChromaKey,
  EditorCaption,
  AnimationOverlay,
  ImageOverlay,
  MediaChoice,
  SectionFit,
} from './model';
import { pruneEmpty } from './prune';
import { overlayFiltersFrom } from './overlay-filters';

// Default authoring locale for Translation fields the editor emits (section descriptions,
// overlay/form text all key under 'en'). Single source so future i18n has one place to change.
const DEFAULT_LOCALE = 'en';

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
// rotation only when nonzero, flip/motion when set — so opaque/upright/static overlays stay clean.
function animationOptions(animation: AnimationOverlay) {
  return {
    ...animationExtent(animation),
    persistent: animation.persistent ?? true,
    ...(animation.start ? { start: animation.start } : {}),
    ...(animation.position ? { position: animation.position } : {}),
    ...(animation.scale ? { scale: animation.scale } : {}),
    // 'stretch' is the engine default, so only a real aspect choice (contain/cover) is written.
    ...(animation.fit && animation.fit !== 'stretch' ? { fit: animation.fit } : {}),
    ...(animation.opacity !== undefined && animation.opacity < 1 ? { opacity: animation.opacity } : {}),
    ...(animation.rotation ? { rotation: animation.rotation } : {}),
    ...(animation.flip ? { flip: animation.flip } : {}),
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

// Trim float noise off a seconds arithmetic result (0.3 - 0.1 → 0.2, not 0.19999999999999998).
const trimSeconds = (value: number): number => Number(value.toFixed(4));

// The editor's show window (start/end seconds) → the input's start/duration options. The engine
// lowers these to the overlay filter's timeline enable for images. start 0 and a non-positive
// window are omitted (untimed = spans the whole section), keeping the descriptor minimal.
function imageTimingFrom(overlay: ImageOverlay): { start?: number; duration?: number } {
  const start = overlay.start ?? 0;

  return {
    ...(start > 0 ? { start } : {}),
    ...(overlay.end !== undefined && overlay.end > start ? { duration: trimSeconds(overlay.end - start) } : {}),
  };
}

// A still-image overlay → a `type: 'image'` input composited via the same overlay path as animations.
// Named `image_<i>` by array position. position/scale/opacity(<1)/rotation(≠0)/flip/timing pass through when set.
// A builder-drawn shape carries its vector recipe (`shape`) on the input — editor metadata the engine
// ignores; the actual pixels are the choice's pre-rasterized PNG data: URL.
function imageInputFrom(overlay: ImageOverlay, index: number): NonNullable<Section['inputs']>[number] {
  const options = {
    ...(overlay.position ? { position: overlay.position } : {}),
    ...(overlay.scale ? { scale: overlay.scale } : {}),
    // 'stretch' is the engine default, so only a real aspect choice (contain/cover) is written.
    ...(overlay.fit && overlay.fit !== 'stretch' ? { fit: overlay.fit } : {}),
    ...(overlay.opacity !== undefined && overlay.opacity < 1 ? { opacity: overlay.opacity } : {}),
    ...(overlay.rotation ? { rotation: overlay.rotation } : {}),
    ...(overlay.flip ? { flip: overlay.flip } : {}),
    ...imageTimingFrom(overlay),
    ...(overlay.motion ? { motion: overlay.motion } : {}),
  };

  return {
    name: `image_${index}`,
    url: markerFromChoice(overlay.choice),
    type: 'image',
    ...(overlay.shape ? { shape: overlay.shape } : {}),
    options,
  };
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

// Per-section playback tempo (options.speed, a PTS multiplier — see model.VisualPlayback). Normal
// speed (1 / unset) emits nothing so untouched sections stay clean.
function sectionPlaybackOptions(section: { speed?: number }): Partial<{ speed: number }> {
  if (section.speed === undefined || section.speed === 1) return {};

  return { speed: section.speed };
}

// The section's source-footage fit → the descriptor aspect flags SegmentBuilder lowers to
// scale/crop (cover) or scale/pad (letterbox). The default cover fit emits nothing.
function sectionFitOptions(section: {
  fit?: SectionFit;
}): Partial<{ forceAspectRatio: boolean; forceOriginalAspectRatio: boolean }> {
  if (section.fit === 'letterbox') return { forceOriginalAspectRatio: true };

  if (section.fit === 'off') return { forceAspectRatio: false };

  return {};
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
      ...sectionPlaybackOptions(section),
    },
    ...(section.titleCard ? { titleCard: section.titleCard as Section['titleCard'] } : {}),
    ...(filters.length > 0 ? { filters } : {}),
    ...visualExtras(section),
    ...(overlayInputs.length > 0 ? { inputs: overlayInputs } : {}),
  };
}

type VideoSection = Extract<EditorSection, { kind: 'video' }>;

// Asset-backed clip (videoUrl set): a fixed bumper / stock video the engine re-encodes via its
// VideoSegment path — emitted as `type: 'video'` + `options.videoUrl`. Recorder-only metadata
// (countdown, capture modes, framing guide, filming instructions) is dropped: nothing is filmed.
function clipDescriptorFrom(section: VideoSection, videoUrl: MediaChoice, index: number): Section {
  const filters = overlayFiltersFrom(section.overlays);
  const overlayInputs = overlayInputsFrom(section);

  return {
    name: `clip_${index}`,
    type: 'video',
    options: {
      duration: section.duration,
      muteSection: section.mute,
      videoUrl: markerFromChoice(videoUrl),
      ...sectionAudioOptions(section),
      ...sectionPlaybackOptions(section),
      ...sectionFitOptions(section),
    },
    ...(section.lowerThird ? { lowerThird: section.lowerThird as Section['lowerThird'] } : {}),
    ...(filters.length > 0 ? { filters } : {}),
    ...visualExtras(section),
    ...(overlayInputs.length > 0 ? { inputs: overlayInputs } : {}),
  };
}

function videoDescriptorFrom(section: VideoSection, index: number): Section {
  if (section.videoUrl) return clipDescriptorFrom(section, section.videoUrl, index);

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
      // Recorder metadata (never lowered to filters): the preselected mode and the allowed set,
      // each emitted only when the author set them (omitted = front / all four).
      ...(section.captureMode ? { captureMode: section.captureMode } : {}),
      ...(section.allowedCaptureModes && section.allowedCaptureModes.length > 0
        ? { allowedCaptureModes: section.allowedCaptureModes }
        : {}),
      ...sectionAudioOptions(section),
      ...sectionPlaybackOptions(section),
      ...sectionFitOptions(section),
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
      options: {
        duration: section.duration,
        ...sectionAudioOptions(section),
        ...sectionPlaybackOptions(section),
        ...sectionFitOptions(section),
      },
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
  let clipIndex = 0;
  let imageIndex = 0;
  let descIndex = 0;

  const counted = sections.map((section): IndexedSection => {
    // Asset-backed clips run on their own counter (clip_1…): the `video_<i>` names are reserved for
    // the camera sections the apps map recorded/uploaded user clips onto, in order.
    if (section.kind === 'video' && section.videoUrl) return { section, index: (clipIndex += 1) };

    if (section.kind === 'video') return { section, index: (videoIndex += 1) };

    if (section.kind === 'image') return { section, index: (imageIndex += 1) };

    return { section, index: (descIndex += 1) };
  });

  return counted.map(descriptorFor).filter((s): s is Section => s !== null);
}

// The emitted names of the sections a whole-video text overlay can target (global.overlays[].sections):
// the renderable ones only. form is metadata (never rendered) and a partial's inner sections carry the
// partial's own (possibly prefixed) names, so neither can be matched by the compiler's per-section filter.
export function renderableSectionNames(sections: EditorSection[]): string[] {
  return mapEditorSections(sections)
    .filter((section) => section.type !== 'form' && section.type !== 'partial')
    .map((section) => section.name)
    .filter((name): name is string => typeof name === 'string');
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

// The ducking field to emit: off emits nothing, on-with-defaults emits `true`, and a fine-tuned
// object passes through — collapsing back to `true` when every knob was cleared.
function duckingField(ducking: AudioMix['ducking']): { ducking?: true | AudioMix['ducking'] } {
  if (ducking === false) return {};

  if (ducking === true) return { ducking: true };

  const tuned = pruneEmpty(ducking);

  return Object.keys(tuned).length > 0 ? { ducking: tuned as AudioMix['ducking'] } : { ducking: true };
}

// editor audio mix -> global.audio, dropping normalize/ducking unless set/enabled.
function audioGlobal(audio: AudioMix): NonNullable<NonNullable<TemplateDescriptor['global']>['audio']> {
  return {
    sourceVolume: audio.sourceVolume,
    musicVolume: audio.musicVolume,
    ...(audio.normalize ? { normalize: audio.normalize } : {}),
    ...duckingField(audio.ducking),
  };
}

// The template palette with blank swatch rows dropped; empty/absent palettes emit nothing.
function paletteFrom(state: EditorState): string[] {
  return (state.colorsList ?? []).filter((color) => color.trim() !== '');
}

// The template's human-facing identity (descriptor.meta) — name/description trimmed and emitted
// only when non-blank, so an exported JSON stays self-describing while untouched fields stay clean.
function metaFrom(state: EditorState): Pick<TemplateDescriptor, 'meta'> {
  const name = state.name.trim();
  const description = state.description.trim();

  if (!name && !description) return {};

  return { meta: { ...(name ? { name } : {}), ...(description ? { description } : {}) } };
}

// Pure: editor state -> a core TemplateDescriptor.
export function buildDescriptor(state: EditorState): TemplateDescriptor {
  const palette = paletteFrom(state);

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
    // The colour palette lands in BOTH descriptor slots: global.colorsList (user-facing, read by the
    // apps) and global.variables.colorsList (engine — FormatterManager.formatColor resolves the
    // '{{ colorN }}' tokens from there at compile time).
    ...(palette.length > 0 ? { colorsList: palette, variables: { colorsList: palette } } : {}),
    ...mediaGlobals(state.sections),
  };

  const variables = authorVariables(state.globalVariables);

  if (Object.keys(variables).length > 0) {
    global.variables = { ...global.variables, ...variables };
  }

  return { ...metaFrom(state), global, sections: mapEditorSections(state.sections) };
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
