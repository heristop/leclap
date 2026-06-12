import { z } from 'zod';

export const TranslationSchema = z.record(z.string(), z.string());

export const MusicConfigSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
});

export const VariablesSchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

export const GlobalConfigSchema = z.object({
  variables: VariablesSchema.optional(),
  orientation: z.enum(['landscape', 'portrait']).optional(),
  colorsList: z.array(z.string()).optional(),
  musicEnabled: z.boolean().optional(),
  audioVolumeLevel: z.number().min(0).max(1).optional(),
  musicVolumeLevel: z.number().min(0).max(1).optional(),
  transitionDuration: z.number().positive().optional(),
  music: MusicConfigSchema.optional(),
  allowedMusic: z.array(z.string()).optional(),
  allowUploadMusic: z.boolean().optional(),
  allowedBackgrounds: z.array(z.string()).optional(),
  allowUploadBackground: z.boolean().optional(),
});

export const FilterValuesSchema = z.object({
  h: z.union([z.number(), z.string()]).optional(),
  w: z.union([z.number(), z.string()]).optional(),
  x: z.union([z.number(), z.string()]).optional(),
  y: z.union([z.number(), z.string()]).optional(),
  c: z.string().optional(),
  t: z.union([z.string(), z.number()]).optional(),
  text: TranslationSchema.optional(),
  fontcolor: z.string().optional(),
  fontsize: z.union([z.number(), z.string()]).optional(),
  fontfile: z.string().optional(),
  alpha: z.string().optional(),
  d: z.string().optional(),
  st: z.string().optional(),
  color: z.string().optional(),
});

export const FilterSchema = z.object({
  type: z.string(),
  value: z.union([z.string(), z.number()]).optional(),
  values: FilterValuesSchema.optional(),
  range: z.string().optional(),
});

export const MapOptionsSchema = z.object({
  useSectionFilters: z.boolean().optional(),
});

export const MapSchema = z.object({
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
  filters: z.array(FilterSchema).optional(),
  options: MapOptionsSchema.optional(),
});

export const InputOptionsSchema = z.object({
  frames: z.number().optional(),
  frequency: z.number().optional(),
  overlay: z.string().optional(),
  scale: z.string().optional(),
  persistent: z.boolean().optional(),
});

export const InputSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  type: z.string().optional(),
  options: InputOptionsSchema.optional(),
  filters: z.array(FilterSchema).optional(),
});

export const FieldSchema = z.object({
  name: z.string(),
  maxLength: z.number().positive(),
  label: TranslationSchema,
});

export const BaseSectionOptionsSchema = z.object({
  upperCase: z.boolean().optional(),
  lowerCase: z.boolean().optional(),
  useVideoSection: z.string().optional(),
  duration: z.number().positive().optional(),
  musicVolumeLevel: z.number().min(0).max(1).optional(),
  fields: z.array(FieldSchema).optional(),
  speed: z.number().positive().optional(),
  muteSection: z.boolean().optional(),
  countdown: z.boolean().optional(),
  countdownDuration: z.number().positive().optional(),
  videoUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  backgroundUrl: z.string().optional(),
  backgroundColor: z.string().optional(),
  pictureUrl: z.string().optional(),
  forceAspectRatio: z.boolean().optional(),
  forceOriginalAspectRatio: z.boolean().optional(),
});

export const BaseSectionSchema = z.object({
  name: z.string(),
  inputs: z.array(InputSchema).optional(),
  maps: z.array(MapSchema).optional(),
  filters: z.array(FilterSchema).optional(),
  title: TranslationSchema.optional(),
  description: TranslationSchema.optional(),
});

export const VideoSectionSchema = BaseSectionSchema.extend({
  type: z.literal('video'),
  options: BaseSectionOptionsSchema.optional(),
});

export const ProjectVideoSectionSchema = BaseSectionSchema.extend({
  type: z.literal('project_video'),
  options: BaseSectionOptionsSchema.optional(),
});

export const FormSectionSchema = BaseSectionSchema.extend({
  type: z.literal('form'),
  options: BaseSectionOptionsSchema.extend({
    fields: z.array(FieldSchema).optional(),
  }).optional(),
});

export const ColorBackgroundSectionSchema = BaseSectionSchema.extend({
  type: z.literal('color_background'),
  options: BaseSectionOptionsSchema.extend({
    backgroundColor: z.string().optional(),
  }).optional(),
});

export const ImageBackgroundSectionSchema = BaseSectionSchema.extend({
  type: z.literal('image_background'),
  options: BaseSectionOptionsSchema.extend({
    pictureUrl: z.string().optional(),
  }).optional(),
});

export const MusicSectionSchema = BaseSectionSchema.extend({
  type: z.literal('music'),
  options: BaseSectionOptionsSchema.optional(),
});

export const SectionSchema = z.discriminatedUnion('type', [
  VideoSectionSchema,
  ProjectVideoSectionSchema,
  FormSectionSchema,
  ColorBackgroundSectionSchema,
  ImageBackgroundSectionSchema,
  MusicSectionSchema,
]);

export const TemplateDescriptorSchema = z.object({
  global: GlobalConfigSchema.optional(),
  sections: z.array(SectionSchema).optional(),
});

export type TemplateDescriptor = z.infer<typeof TemplateDescriptorSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Filter = z.infer<typeof FilterSchema>;
export type Map = z.infer<typeof MapSchema>;
export type Input = z.infer<typeof InputSchema>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export type Variables = z.infer<typeof VariablesSchema>;
export type Translation = z.infer<typeof TranslationSchema>;
export type MusicConfig = z.infer<typeof MusicConfigSchema>;
