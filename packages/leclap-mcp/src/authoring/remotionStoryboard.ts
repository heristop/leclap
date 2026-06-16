import { z } from 'zod';

const TranslationInputSchema = z.union([z.string(), z.record(z.string(), z.string())]);

const TextOverlaySchema = z.object({
  value: TranslationInputSchema,
  position: z.enum(['top', 'center', 'bottom', 'lower-third']).default('lower-third'),
  style: z.enum(['bar', 'subtle', 'bold']).default('bar'),
});

const BackgroundSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('color'), color: z.string().min(1) }),
  z.object({ type: z.literal('image'), src: z.string().min(1) }),
  z.object({ type: z.literal('video'), src: z.string().min(1), userProvided: z.boolean().default(false) }),
]);

const TransitionSchema = z.object({
  type: z.string().min(1).default('cut'),
  duration: z.number().positive().optional(),
});

export const RemotionStoryboardSequenceSchema = z.object({
  id: z.string().regex(/^[A-Za-z][\w-]*$/),
  duration: z.number().positive(),
  background: BackgroundSchema,
  text: z.array(TextOverlaySchema).default([]),
  transitionAfter: TransitionSchema.optional(),
  look: z.enum(['cinematic', 'warm', 'cool', 'vintage', 'noir', 'vivid', 'dreamy']).optional(),
});

export const RemotionStoryboardSchema = z.object({
  title: z.string().optional(),
  orientation: z.enum(['landscape', 'portrait']).default('landscape'),
  variables: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  music: z
    .object({
      src: z.string().min(1),
      volume: z.number().min(0).max(1).default(0.5),
    })
    .optional(),
  sequences: z.array(RemotionStoryboardSequenceSchema).min(1),
});

export type RemotionStoryboard = z.infer<typeof RemotionStoryboardSchema>;
