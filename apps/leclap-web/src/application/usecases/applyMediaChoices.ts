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

function applyMusicChoice(descriptor: TemplateDescriptor, choice: MediaChoice): void {
  descriptor.global ??= {};
  descriptor.global.music = resolveMusic(choice);
  descriptor.global.musicEnabled = true;
}

function applyBackgroundChoice(descriptor: TemplateDescriptor, choice: MediaChoice): void {
  const url = resolveBg(choice);

  for (const section of descriptor.sections ?? []) {
    if (section.type === 'image_background') {
      section.options = { ...section.options, pictureUrl: url } as ImageBackgroundOptions;
    }
  }
}

// Author-set image-overlay inputs (a video section's background/logo) carry a `library://<id>`
// marker; resolve it to the curated `/backgrounds/<file>` url. `media://` uploads are left for
// materializeTemplateMedia; pasted urls pass through untouched.
function resolveLibraryInputMarkers(descriptor: TemplateDescriptor): void {
  for (const section of descriptor.sections ?? []) {
    for (const input of section.inputs ?? []) {
      if (input.url?.startsWith('library://')) {
        input.url = findBackground(input.url.slice('library://'.length))?.url ?? input.url;
      }
    }
  }
}

/**
 * Injects user-chosen music and background into a template descriptor in place,
 * BEFORE materializeTemplateMedia runs. Curated library URLs land as-is;
 * uploaded blob references land as `media://<key>` which materializeTemplateMedia
 * then copies into the engine filesystem.
 */
export function applyMediaChoices(descriptor: TemplateDescriptor, choices: MediaChoices): void {
  if (choices.music) {
    applyMusicChoice(descriptor, choices.music);
  }

  if (choices.background) {
    applyBackgroundChoice(descriptor, choices.background);
  }

  resolveLibraryInputMarkers(descriptor);
}
