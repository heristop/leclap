// The engine vocabulary the model may use, gathered from the engine's public schema constants plus
// the app's bundled media, and rendered as a compact prompt block. Values the schema already lists
// as enums are repeated here on purpose: a short named list is far easier for a model to pick from
// than an enum buried in a 60 KB schema. Pure data + formatting; the app layer builds the catalog.
import {
  LOOK_PRESETS,
  MotionEffectSchema,
  REVEAL_EASINGS,
  REVEAL_TYPES,
  XFADE_TRANSITIONS,
} from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { FONTS } from 'ffmpeg-video-composer/src/core/fonts.ts';
import { motionCatalog, type MotionCatalog } from 'ffmpeg-video-composer/src/core/motion/index.ts';

export interface CatalogEntry {
  id: string;
  description?: string;
}

export interface EngineCatalog {
  looks: string[];
  transitions: string[];
  motionEffects: CatalogEntry[];
  // The engine's motion catalog (kinetic type, easing, camera, designed transitions, graphics,
  // delivery platforms and its own art-direction rules), passed through verbatim.
  motion: MotionCatalog;
  reveals: string[];
  easings: string[];
  fonts: CatalogEntry[];
  music: string[];
  animations: string[];
  // Built-in visual themes (`global.theme`), from the motion catalog; optional for older engines.
  themes?: CatalogEntry[];
}

export interface CatalogMedia {
  music: string[];
  animations: string[];
}

// Motion effect ids + their one-line descriptions, read from the discriminated union itself so new
// effects show up without touching this file.
function motionEntries(): CatalogEntry[] {
  return MotionEffectSchema.options.map((option) => ({
    id: option.shape.type.value,
    description: option.shape.type.description,
  }));
}

// The engine's built-in themes (palette, fonts, motion feel) as pickable entries.
function themeEntries(motion: MotionCatalog): CatalogEntry[] {
  return motion.themes.themes.map((theme) => ({ id: theme.name, description: theme.description }));
}

export function buildEngineCatalog(media: CatalogMedia): EngineCatalog {
  const motion = motionCatalog();

  return {
    looks: [...LOOK_PRESETS],
    transitions: ['cut', ...XFADE_TRANSITIONS],
    motionEffects: motionEntries(),
    motion,
    themes: themeEntries(motion),
    reveals: [...REVEAL_TYPES],
    easings: [...REVEAL_EASINGS],
    fonts: FONTS.map((font) => ({ id: font.file, description: font.label })),
    music: media.music,
    animations: media.animations,
  };
}

function entryLines(entries: CatalogEntry[]): string {
  return entries
    .map((entry) => (entry.description ? `- ${entry.id}: ${entry.description}` : `- ${entry.id}`))
    .join('\n');
}

// The motion catalog for the prompt, minus what the builder cannot author: partials (never in a builder
// template) and the take-editing guide (user LUT files, B-roll URLs, Node-only silence trimming). With a
// known genre, only that genre's doctrine travels (the others are noise for this brief and cost tokens).
export function motionForPrompt(motion: MotionCatalog, genre?: string): Omit<MotionCatalog, 'partials'> {
  const { partials: _partials, footage, ...rest } = motion;
  const { take: _take, ...builderFootage } = footage;
  const trimmed = { ...rest, footage: builderFootage as MotionCatalog['footage'] };

  if (!genre || !Object.hasOwn(motion.doctrine, genre)) return trimmed;

  const key = genre as keyof MotionCatalog['doctrine'];

  return { ...trimmed, doctrine: { [key]: motion.doctrine[key] } as MotionCatalog['doctrine'] };
}

export function formatCatalog(catalog: EngineCatalog, genre?: string): string {
  const blocks = [
    `Looks (section or global "look"): ${catalog.looks.join(', ')}`,
    `Transitions ("transition.type"): ${catalog.transitions.join(', ')}`,
    `Section motion effects ("motion": [{type,...}]):\n${entryLines(catalog.motionEffects)}`,
    `Text reveal types: ${catalog.reveals.join(', ')}; easings: ${catalog.easings.join(', ')}`,
    `Fonts (drawtext "fontfile", use the exact file name):\n${entryLines(catalog.fonts)}`,
    `Music files (global.music.name takes the file name; global.allowedMusic takes ids = file name without extension): ${catalog.music.join(', ')}`,
    `Animation overlays (inputs[].url, type "animation"): ${catalog.animations.map((file) => `/assets/animations/${file}`).join(', ')}`,
  ];

  blocks.push(
    `Motion catalog (kinetic type, easing, camera, transitions, graphics, platforms; follow its rules):\n${JSON.stringify(motionForPrompt(catalog.motion, genre))}`
  );

  return blocks.join('\n\n');
}
