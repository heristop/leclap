import { z } from 'zod';
import { TransitionSchema, GlobalAudioSchema } from './effects.schemas';

export const TranslationSchema = z
  .record(z.string(), z.string())
  .describe('Locale-keyed map of translated strings, e.g. { en: "Hello", fr: "Bonjour" }.');

export const MusicConfigSchema = z
  .object({
    name: z.string().describe('Human-readable name of the music track.'),
    url: z.string().optional().describe('URL of the music file; omit to use an app-managed track.'),
  })
  .describe('Music track reference used in global.music.');

export const VariablesSchema = z
  .record(z.string(), z.union([z.string(), z.array(z.string())]))
  .describe('Named variables injected into filter values and URLs via {{ varName }} syntax.');

// ── global config ──────────────────────────────────────────────────────────────

export const GlobalConfigSchema = z
  .object({
    variables: VariablesSchema.optional().describe(
      'Template-wide variable definitions referenced via {{ varName }} syntax.'
    ),
    orientation: z
      .enum(['landscape', 'portrait'])
      .optional()
      .describe('Output video orientation; controls which resolution preset is used (default: landscape).'),
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
