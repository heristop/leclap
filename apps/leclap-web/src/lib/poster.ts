import type { TemplateDescriptor } from '@/services/templateService';
import type { SectionKind } from './sectionMeta';

// Deterministic, seeded visuals — one home so music covers (MediaPicker) and template posters
// share the same hashing.
export const coverGradient = (seed: string): string => {
  let hash = 7;

  for (const char of seed) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }

  const second = (hash + 48) % 360;

  return `linear-gradient(135deg, oklch(0.62 0.19 ${hash}), oklch(0.5 0.21 ${second}))`;
};

const TYPE_TO_KIND: Record<string, SectionKind> = {
  form: 'form',
  color_background: 'color',
  music: 'music',
  image: 'image',
  partial: 'partial',
};

const typeToKind = (type?: string): SectionKind => TYPE_TO_KIND[type ?? ''] ?? 'video';

// A seeded gradient + up to five section glyphs that preview a template's shape.
export const templatePoster = (
  id: string,
  descriptor: TemplateDescriptor
): { gradient: string; glyphs: SectionKind[] } => ({
  gradient: coverGradient(id),
  glyphs: (descriptor.sections ?? []).slice(0, 5).map((section) => typeToKind((section as { type?: string }).type)),
});
