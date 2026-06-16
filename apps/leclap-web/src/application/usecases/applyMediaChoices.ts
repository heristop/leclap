import type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';
import type { MediaChoice } from '@/presentation/components/admin/templateEditorModel';
import { findMusic, findBackground } from '@/data/mediaCatalog';

export interface MediaChoices {
  music?: MediaChoice | null;
  background?: MediaChoice | null;
}

// SectionOptions from core omits pictureUrl at the type level; cast locally for image_background access.
type ImageBackgroundOptions = NonNullable<TemplateDescriptor['sections']>[number]['options'] & {
  pictureUrl?: string;
};

function resolveMusic(choice: MediaChoice): { name: string; url?: string } {
  if (choice.source === 'library') {
    const entry = findMusic(choice.id);

    return { name: choice.id, url: entry?.url };
  }

  if (choice.source === 'url') {
    // A pasted remote URL is fetched as-is by the engine; name is a readable label (the file part).
    const file = choice.url.split('/').filter(Boolean).at(-1);

    return { name: file ?? choice.url, url: choice.url };
  }

  return { name: choice.key, url: `media://${choice.key}` };
}

function resolveBg(choice: MediaChoice): string {
  if (choice.source === 'library') {
    return findBackground(choice.id)?.url ?? '';
  }

  if (choice.source === 'url') {
    return choice.url;
  }

  return `media://${choice.key}`;
}

/**
 * Injects user-chosen music and background into a template descriptor in place,
 * BEFORE materializeTemplateMedia runs. Curated library URLs land as-is;
 * uploaded blob references land as `media://<key>` which materializeTemplateMedia
 * then copies into the engine filesystem.
 */
export function applyMediaChoices(descriptor: TemplateDescriptor, choices: MediaChoices): void {
  if (choices.music) {
    descriptor.global ??= {};
    descriptor.global.music = resolveMusic(choices.music);
    descriptor.global.musicEnabled = true;
  }

  if (choices.background) {
    const url = resolveBg(choices.background);

    for (const section of descriptor.sections ?? []) {
      if (section.type === 'image_background') {
        section.options = { ...section.options, pictureUrl: url } as ImageBackgroundOptions;
      }
    }
  }
}
