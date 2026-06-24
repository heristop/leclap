import { z } from 'zod';
import { TransitionSchema, GlobalAudioSchema, GradeSchema, LOOK_PRESETS, RevealSchema } from './effects.schemas';

export const TranslationSchema = z
  .record(z.string(), z.string())
  .describe('Locale-keyed map of translated strings, e.g. { en: "Hello", fr: "Bonjour" }.');

// A whole-video text overlay (e.g. a brand watermark) authored once in global and composited onto
// every section — the text sibling of global.animations. Lowered by the global-decorations preset.
export const GLOBAL_TEXT_POSITIONS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'top',
  'bottom',
  'center',
] as const;

export const GlobalTextOverlaySchema = z
  .object({
    text: TranslationSchema.describe('Localised text drawn over every section (e.g. a brand name).'),
    position: z.enum(GLOBAL_TEXT_POSITIONS).optional().describe('Anchor for the text (default top-right).'),
    font: z.string().optional().describe('Font id or .ttf filename (default Oswald).'),
    size: z.number().positive().optional().describe('Font size in px; default derived from the output height.'),
    color: z.string().optional().describe('Text colour as a CSS hex string (default white).'),
    opacity: z.number().min(0).max(1).optional().describe('Static text alpha 0..1 when no reveal is set (default 1).'),
    reveal: RevealSchema.optional().describe('Animated entrance for the text (default none).'),
    sections: z
      .array(z.string())
      .optional()
      .describe('Section names this overlay appears on; omit for every section.'),
  })
  .strict()
  .describe('A whole-video text overlay composited onto every section (or a named subset).');

export const MusicConfigSchema = z
  .object({
    name: z.string().describe('Human-readable name of the music track.'),
    url: z.string().optional().describe('URL of the music file; omit to use an app-managed track.'),
  })
  .describe('Music track reference used in global.music.');

export const VariablesSchema = z
  .record(z.string(), z.union([z.string(), z.array(z.string())]))
  .describe('Named variables injected into filter values and URLs via {{ varName }} syntax.');

// A whole-video animation overlay: composited once over the FINAL joined video (after sections are
// concatenated, before music), so it spans every section continuously — unlike a section input which
// restarts each section. Same placement/playback options as a section animation input, minus name/type.
export const GlobalAnimationSchema = z
  .object({
    url: z
      .string()
      .describe('URL or file path of the animation overlay (.apng/.webp/.gif/.webm); may use {{ varName }}.'),
    position: z.string().optional().describe('Overlay position as "x:y" in output pixels (e.g. "0:0" top-left).'),
    scale: z.string().optional().describe('Scale expression applied to the overlay before compositing, as "w:h".'),
    opacity: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Overlay alpha from 0 (invisible) to 1 (opaque); 1 (or omitted) keeps it fully opaque.'),
    rotation: z
      .number()
      .optional()
      .describe('Clockwise rotation in degrees applied to the overlay before compositing.'),
    loop: z
      .boolean()
      .optional()
      .describe('When true, the overlay loops continuously for the whole video duration (default false).'),
    loops: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Number of times the overlay plays (finite). Takes precedence over loop; omit for loop/once.'),
    duration: z
      .number()
      .positive()
      .optional()
      .describe(
        'Seconds the overlay plays before it ends (loops the source to fill). Takes precedence over loops/loop.'
      ),
    start: z
      .number()
      .positive()
      .optional()
      .describe('Seconds to delay the overlay before it appears (via -itsoffset); 0/omitted starts at the beginning.'),
    persistent: z
      .boolean()
      .optional()
      .describe(
        'When true, the overlay freezes its last frame once it ends instead of letting the video show through.'
      ),
  })
  .strict()
  .describe('A single whole-video animation overlay composited over the final joined video.');

// ── global config ──────────────────────────────────────────────────────────────

export const OrientationSchema = z
  .enum(['landscape', 'portrait', 'square'])
  .describe(
    'Output video orientation; controls the resolution preset — landscape 1280x720, portrait 720x1280, square 1080x1080 (default: landscape).'
  );

export type Orientation = z.infer<typeof OrientationSchema>;

export const GlobalConfigSchema = z
  .object({
    variables: VariablesSchema.optional().describe(
      'Template-wide variable definitions referenced via {{ varName }} syntax.'
    ),
    orientation: OrientationSchema.optional(),
    colorsList: z
      .array(z.string())
      .optional()
      .describe('Palette of colours offered to the user for customisation, as CSS hex strings.'),
    musicEnabled: z
      .boolean()
      .optional()
      .describe('Whether background music is enabled for this template (default true).'),
    transition: TransitionSchema.optional().describe(
      'Default transition applied between sections when no per-section transition is set.'
    ),
    audio: GlobalAudioSchema.optional().describe('Global audio mix settings (volumes, normalisation, ducking).'),
    music: MusicConfigSchema.optional().describe('Default background music track for the template.'),
    animations: z
      .array(GlobalAnimationSchema)
      .optional()
      .describe('Whole-video animation overlays composited over the final joined video, spanning all sections.'),
    overlays: z
      .array(GlobalTextOverlaySchema)
      .optional()
      .describe('Whole-video text overlays (e.g. a brand watermark) composited onto every section.'),
    look: z.enum(LOOK_PRESETS).optional().describe('Colour-grade preset applied across every section (whole-video look).'),
    grade: GradeSchema.optional().describe('Fine-grained colour grade applied across every section.'),
    allowedMusic: z
      .array(z.string())
      .optional()
      .describe('Allowlist of music track identifiers the user may choose from.'),
    allowUploadMusic: z
      .boolean()
      .optional()
      .describe('Whether the user is allowed to upload a custom music file (default false).'),
    allowedBackgrounds: z
      .array(z.string())
      .optional()
      .describe('Allowlist of background asset identifiers the user may choose from.'),
    allowUploadBackground: z
      .boolean()
      .optional()
      .describe('Whether the user is allowed to upload a custom background image (default false).'),
  })
  .strict()
  .describe('Template-wide configuration applied as defaults across all sections.');
