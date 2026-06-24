import { z } from 'zod';
import {
  AudioFadeSchema,
  BackgroundLayerSchema,
  FramingGuideSchema,
  GradeSchema,
  LOOK_PRESETS,
  MotionEffectSchema,
  TransitionSchema,
} from './effects.schemas';
import { TranslationSchema, GlobalConfigSchema } from './global.schemas';
import { FilterSchema, MapSchema } from './filter.schemas';
import { CaptionSchema, TitleCardSchema, LowerThirdSchema } from './text.schemas';

export {
  CAPTION_STYLES,
  CAPTION_POSITIONS,
  CAPTION_ALIGNS,
  CaptionSchema,
  TitleCardSchema,
  LowerThirdSchema,
  type Caption,
} from './text.schemas';

// ── input ──────────────────────────────────────────────────────────────────────

export const InputOptionsSchema = z
  .object({
    fps: z.number().positive().optional().describe('Frames per second the animation plays at (default 25).'),
    position: z.string().optional().describe('Overlay position as "x:y" in output pixels (e.g. "0:0" top-left).'),
    scale: z.string().optional().describe('Scale expression applied to the input before compositing, as "w:h".'),
    persistent: z
      .boolean()
      .optional()
      .describe('When true, freeze the last frame once the overlay ends (default false).'),
    loop: z.boolean().optional().describe('When true, loop continuously for the section/video (default false).'),
    loops: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Finite number of times the overlay plays. Takes precedence over loop; omit for loop/once.'),
    duration: z
      .number()
      .positive()
      .optional()
      .describe('Seconds the overlay plays before it ends (loops the source to fill). Precedence over loops/loop.'),
    start: z.number().positive().optional().describe('Seconds to delay the overlay before it appears (default 0).'),
    opacity: z.number().min(0).max(1).optional().describe('Overlay alpha 0–1; 1 (or omitted) keeps it fully opaque.'),
    rotation: z.number().optional().describe('Clockwise rotation in degrees applied before compositing.'),
  })
  .strict()
  .describe('Playback and compositing options for an animation input.');

export const InputSchema = z
  .object({
    name: z.string().describe('Unique identifier for this input within the section, used as a stream label in maps.'),
    url: z
      .string()
      .optional()
      .describe('URL or file path of the input asset; may use {{ varName }} template variables.'),
    type: z
      .enum(['animation', 'image'])
      .optional()
      .describe('"animation" = animated overlay (.apng/.webp/.gif/.webm); "image" = still held for section duration.'),
    options: InputOptionsSchema.optional().describe('Playback and compositing options for this input.'),
    filters: z.array(FilterSchema).optional().describe('Filter chain applied to this input stream before compositing.'),
  })
  .describe('An external asset (animation or still image) composited into the section video.');

// ── section options ────────────────────────────────────────────────────────────

export const FieldSchema = z
  .object({
    name: z.string().describe('Unique identifier for this form field, used as a variable name in filter templates.'),
    maxLength: z.number().positive().describe('Maximum number of characters allowed in this field.'),
    label: TranslationSchema.describe('Localised display label shown to the user for this field.'),
  })
  .describe('A single user-editable text field rendered in a form section.');

export const BaseSectionOptionsSchema = z
  .object({
    upperCase: z
      .boolean()
      .optional()
      .describe('When true, all text values in this section are rendered in upper case (default false).'),
    lowerCase: z
      .boolean()
      .optional()
      .describe('When true, all text values in this section are rendered in lower case (default false).'),
    useVideoSection: z
      .string()
      .optional()
      .describe(
        'Name of a project_video section whose recorded clip is reused in this section instead of capturing a new one.'
      ),
    duration: z
      .number()
      .positive()
      .optional()
      .describe('Fixed duration of the section in seconds; overrides clip length.'),
    musicVolume: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Per-section music volume override, 0..1; overrides global.audio.musicVolume for this section.'),
    audioFade: z
      .object({
        in: AudioFadeSchema.optional().describe('Fade-in applied at the start of the section audio.'),
        out: AudioFadeSchema.optional().describe('Fade-out applied at the end of the section audio.'),
      })
      .optional()
      .describe('Audio fade-in/out applied to this section.'),
    fields: z.array(FieldSchema).optional().describe('Form fields defined for this section (used in form sections).'),
    speed: z
      .number()
      .positive()
      .optional()
      .describe('Playback speed multiplier applied to the section clip (default 1).'),
    muteSection: z
      .boolean()
      .optional()
      .describe('When true, the source audio of this section is silenced (default false).'),
    countdown: z
      .boolean()
      .optional()
      .describe('When true, a countdown overlay is shown before recording starts (default false).'),
    countdownDuration: z
      .number()
      .positive()
      .optional()
      .describe('Duration of the countdown in seconds (default 3); only used when countdown is true.'),
    videoUrl: z.string().optional().describe('URL of a pre-recorded video asset used as the section clip.'),
    logoUrl: z.string().optional().describe('URL of a logo image composited into the section.'),
    backgroundUrl: z
      .string()
      .optional()
      .describe('URL of a background image or video composited behind the section content.'),
    backgroundColor: z.string().optional().describe('Solid background colour as a CSS hex string (e.g. "#000000").'),
    pictureUrl: z.string().optional().describe('URL of a picture asset used as the section background or overlay.'),
    forceAspectRatio: z
      .boolean()
      .optional()
      .describe('Cover-crop the clip to fill the output frame, never stretching (on by default; false skips scaling).'),
    forceOriginalAspectRatio: z
      .boolean()
      .optional()
      .describe('Preserve original aspect ratio via letterboxing (no crop); overrides cover-crop (default false).'),
  })
  .strict()
  .describe('Common options shared by all section types; variant-specific options are added via extend.');

// ── base section ───────────────────────────────────────────────────────────────

export const BaseSectionSchema = z
  .object({
    name: z.string().describe('Unique identifier for the section within the template, used in section references.'),
    inputs: z
      .array(InputSchema)
      .optional()
      .describe('Animation and image overlays composited on top of the section video, in array order.'),
    maps: z
      .array(MapSchema)
      .optional()
      .describe('Custom FFmpeg filtergraph maps overriding the default compositing pipeline.'),
    filters: z.array(FilterSchema).optional().describe('Filter chain applied to the section output stream.'),
    title: TranslationSchema.optional().describe('Localised display title shown to the user for this section.'),
    description: TranslationSchema.optional().describe(
      'Localised description shown to the user to explain what to record or fill in.'
    ),
    transition: TransitionSchema.optional().describe(
      'Transition applied after this section; overrides global.transition.'
    ),
    caption: CaptionSchema.optional().describe('Styled on-screen caption rendered as a drawtext filter.'),
    lowerThird: LowerThirdSchema.optional().describe('Title/subtitle band composited over the section clip.'),
    look: z
      .enum(LOOK_PRESETS)
      .optional()
      .describe('Named colour-grade preset applied to the section video (default: none).'),
    grade: GradeSchema.optional().describe('Fine-grained colour-grade settings applied to the section video.'),
    motion: z
      .array(MotionEffectSchema)
      .optional()
      .describe('Ordered list of motion and geometric effects applied to the section video.'),
  })
  .describe('Base fields shared by all section variants.');

// ── section variants ───────────────────────────────────────────────────────────

export const VideoSectionSchema = BaseSectionSchema.extend({
  type: z.literal('video').describe('Section type: renders a pre-recorded or asset-backed video clip.'),
  options: BaseSectionOptionsSchema.optional().describe('Playback and compositing options for the video section.'),
}).describe('A section that plays a pre-recorded video clip or a user-uploaded video asset.');

export const CaptureModeSchema = z.enum(['front', 'back', 'screen', 'upload']);
export type CaptureMode = z.infer<typeof CaptureModeSchema>;

export const ProjectVideoSectionSchema = BaseSectionSchema.extend({
  type: z.literal('project_video').describe('Section type: captures a new video clip from the device camera.'),
  options: BaseSectionOptionsSchema.extend({
    framingGuide: FramingGuideSchema.optional().describe('Camera framing guide overlay shown in the recording UI.'),
    captureMode: CaptureModeSchema.optional().describe('Recorder mode: front/back/screen/upload (default: front).'),
    allowedCaptureModes: z
      .array(CaptureModeSchema)
      .optional()
      .describe('Modes available to the user; omit for all four. A single element locks to one mode.'),
  })
    .strict()
    .optional()
    .describe('Recording and compositing options for the project_video section.'),
}).describe('A section that records a new clip from the device camera; supports a framing guide overlay.');

export const FormSectionSchema = BaseSectionSchema.extend({
  type: z.literal('form').describe('Section type: presents a text-input form to the user.'),
  options: BaseSectionOptionsSchema.extend({
    fields: z.array(FieldSchema).optional().describe('List of user-editable text fields rendered in the form.'),
  })
    .strict()
    .optional()
    .describe('Form layout and field options.'),
}).describe('A section that collects text input from the user via a form.');

export const ColorBackgroundSectionSchema = BaseSectionSchema.extend({
  type: z.literal('color_background').describe('Section type: renders a solid or layered colour background.'),
  titleCard: TitleCardSchema.optional().describe('Structured title card (kicker/headline/subtitle) for this section.'),
  options: BaseSectionOptionsSchema.extend({
    backgroundColor: z.string().optional().describe('Primary background colour as a CSS hex string (e.g. "#000000").'),
    layers: z
      .array(BackgroundLayerSchema)
      .optional()
      .describe('Ordered list of background layers composited on top of the base colour.'),
  })
    .strict()
    .optional()
    .describe('Background and layer options for the color_background section.'),
}).describe(
  'A section that renders a solid colour or composited layer background, typically used for titles or intros.'
);

export const ImageBackgroundSectionSchema = BaseSectionSchema.extend({
  type: z.literal('image_background').describe('Section type: renders a static image as the section background.'),
  options: BaseSectionOptionsSchema.extend({
    pictureUrl: z.string().optional().describe('URL of the background image asset.'),
  })
    .strict()
    .optional()
    .describe('Image URL option for the image_background section.'),
}).describe('A section that renders a static image as its background.');

export const MusicSectionSchema = BaseSectionSchema.extend({
  type: z.literal('music').describe('Section type: a silent or audio-only section used to inject music segments.'),
  options: BaseSectionOptionsSchema.optional().describe('Duration and audio options for the music section.'),
}).describe('A section with no video content, used to pad the timeline or inject music.');

export const PartialSectionSchema = BaseSectionSchema.extend({
  type: z
    .literal('partial')
    .describe('Section type: a reference to a reusable partial, expanded into real sections before validation.'),
  name: z.string().optional().describe('Optional name for the partial reference (mainly for editor display).'),
  options: BaseSectionOptionsSchema.optional().describe('Playback and compositing options for the partial reference.'),
  ref: z.string().optional().describe('Id of a registered partial to expand in place.'),
  prefix: z
    .string()
    .optional()
    .describe('Prepended to each expanded section name, so a partial can be included more than once.'),
  sections: z
    .array(z.unknown())
    .optional()
    .describe('Inline partial sections, expanded in place — an alternative to `ref` for self-contained partials.'),
  variables: z
    .record(z.string(), z.string())
    .optional()
    .describe('Values substituted into the partial’s `{{ key }}` placeholders, so one partial serves many slots.'),
}).describe('A reference to a reusable partial (by `ref`) or an inline one (`sections`), expanded before compilation.');

export const SectionSchema = z.discriminatedUnion('type', [
  VideoSectionSchema,
  ProjectVideoSectionSchema,
  FormSectionSchema,
  ColorBackgroundSectionSchema,
  ImageBackgroundSectionSchema,
  MusicSectionSchema,
  PartialSectionSchema,
]);

export const TemplateMetaSchema = z
  .object({
    name: z.string().optional().describe('Human-readable template name for catalogs and editors.'),
    description: z.string().optional().describe('Short human-readable template summary for catalogs and agents.'),
  })
  .strict()
  .describe('Optional human-facing metadata embedded in the descriptor; behavioral catalog fields are derived.');

export const TemplateDescriptorSchema = z
  .object({
    meta: TemplateMetaSchema.optional().describe('Optional template metadata for display and discovery.'),
    global: GlobalConfigSchema.optional().describe(
      'Template-wide defaults: variables, orientation, audio, transitions, and music.'
    ),
    sections: z
      .array(SectionSchema)
      .optional()
      .describe('Ordered list of sections that make up the video composition timeline.'),
  })
  .describe(
    'Root descriptor of a video composition template; all fields are optional so partial descriptors can be validated incrementally.'
  );
