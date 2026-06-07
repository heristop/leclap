import type { Template } from '@/services/templateService';
import type { TemplateDescriptor } from '@ffmpeg-video-composer/core';
import { findMusic, findBackground, findMusicByUrl, findBackgroundByUrl } from '@/data/mediaCatalog';

export type MediaChoice =
  | { source: 'library'; id: string }
  | { source: 'upload'; key: string; label: string };

// --- Editor-friendly section model (flattened; compiled to a descriptor on save) ---
export type FormField = { name: string; label: string; maxLength: number };
export type EditorSection =
  | { kind: 'form'; fields: FormField[] }
  | { kind: 'video'; duration: number; mute: boolean; text: string; fontsize: number; fontcolor: string }
  | { kind: 'color'; duration: number; color: string }
  | { kind: 'image'; duration: number; background: MediaChoice | null };

export interface EditorState {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  musicEnabled: boolean;
  music: MediaChoice | null;
  sections: EditorSection[];
}

export const SECTION_LABELS: Record<EditorSection['kind'], string> = {
  form: 'Form fields',
  video: 'Your video',
  color: 'Color background',
  image: 'Background image',
};

export function newSection(kind: EditorSection['kind']): EditorSection {
  if (kind === 'form') return { kind: 'form', fields: [{ name: 'firstname', label: 'Your name', maxLength: 40 }] };

  if (kind === 'color') return { kind: 'color', duration: 3, color: '#7C83FD' };

  if (kind === 'image') return { kind: 'image', duration: 4, background: null };

  return { kind: 'video', duration: 8, mute: false, text: '', fontsize: 48, fontcolor: '#ffffff' };
}

function makeTemplateId(): string {
  try {
    const uuid = globalThis.crypto.randomUUID();

    return uuid ? `user-${uuid}` : `user-${Date.now()}`;
  } catch {
    return `user-${Date.now()}`;
  }
}

function musicConfigFrom(choice: MediaChoice): { name: string; url?: string } {
  if (choice.source === 'upload') {
    return { name: choice.key, url: `media://${choice.key}` };
  }

  return { name: choice.id, url: findMusic(choice.id)?.url };
}

function pictureUrlFrom(choice: MediaChoice | null): string {
  if (!choice) {
    return '';
  }

  if (choice.source === 'upload') {
    return `media://${choice.key}`;
  }

  return findBackground(choice.id)?.url ?? '';
}

function choiceFromUrl(rawUrl: string | undefined, kind: 'music' | 'background'): MediaChoice | null {
  const url = rawUrl ?? '';

  if (url === '') {
    return null;
  }

  if (url.startsWith('media://')) {
    return { source: 'upload', key: url.slice('media://'.length), label: 'Uploaded file' };
  }

  const match = kind === 'music' ? findMusicByUrl(url) : findBackgroundByUrl(url);

  return match ? { source: 'library', id: match.id } : null;
}

// Pure: editor state -> a core TemplateDescriptor. project_video sections are
// numbered video_1, video_2… so uploaded files (userVideoPaths keys) map to them.
export function buildDescriptor(state: EditorState): TemplateDescriptor {
  let videoIndex = 0;
  let imageIndex = 0;

  const sections = state.sections.map((section, i): NonNullable<TemplateDescriptor['sections']>[number] => {
    if (section.kind === 'form') {
      return {
        name: `form_${i + 1}`,
        type: 'form',
        options: {
          fields: section.fields.map((f) => ({ name: f.name, maxLength: f.maxLength, label: { en: f.label } })),
        },
      };
    }

    if (section.kind === 'color') {
      return {
        name: `color_${i + 1}`,
        type: 'color_background',
        options: { duration: section.duration, backgroundColor: section.color },
      };
    }

    if (section.kind === 'image') {
      imageIndex += 1;

      return {
        name: `image_${imageIndex}`,
        type: 'image_background',
        options: { duration: section.duration, pictureUrl: pictureUrlFrom(section.background) } as StoredOptions,
      };
    }

    videoIndex += 1;
    const filters = section.text.trim()
      ? [
          {
            type: 'drawtext',
            values: {
              text: { en: section.text },
              fontsize: section.fontsize,
              fontcolor: section.fontcolor,
              fontfile: 'Rubik.ttf',
              x: '(w-text_w)/2',
              y: '(h-text_h)/2',
            },
          },
        ]
      : undefined;

    return {
      name: `video_${videoIndex}`,
      type: 'project_video',
      options: { duration: section.duration, muteSection: section.mute },
      ...(filters ? { filters } : {}),
    };
  });

  const global: NonNullable<TemplateDescriptor['global']> = {
    orientation: state.orientation,
    musicEnabled: state.musicEnabled,
    transitionDuration: 0.5,
  };

  if (state.musicEnabled && state.music) {
    global.music = musicConfigFrom(state.music);
  }

  return { global, sections };
}

type StoredSection = NonNullable<TemplateDescriptor['sections']>[number];
// SectionOptions from core omits pictureUrl; cast locally for image_background access.
type StoredOptions = NonNullable<StoredSection['options']> & { pictureUrl?: string };

function formSectionFrom(s: StoredSection): EditorSection {
  const fields = (s.options?.fields ?? []) as Array<{
    name: string;
    maxLength?: number;
    label?: Record<string, string>;
  }>;

  return {
    kind: 'form',
    fields: fields.map((f) => ({ name: f.name, label: f.label?.en ?? f.name, maxLength: f.maxLength ?? 40 })),
  };
}

function colorSectionFrom(s: StoredSection): EditorSection {
  return { kind: 'color', duration: s.options?.duration ?? 3, color: s.options?.backgroundColor ?? '#7C83FD' };
}

function imageSectionFrom(s: StoredSection): EditorSection {
  const opts = s.options as StoredOptions | undefined;

  return {
    kind: 'image',
    duration: opts?.duration ?? 4,
    background: choiceFromUrl(opts?.pictureUrl, 'background'),
  };
}

function videoSectionFrom(s: StoredSection): EditorSection {
  const dt = (s.filters ?? []).find((f) => f.type === 'drawtext');

  return {
    kind: 'video',
    duration: s.options?.duration ?? 8,
    mute: Boolean(s.options?.muteSection),
    text: dt?.values?.text?.en ?? '',
    fontsize: Number(dt?.values?.fontsize ?? 48),
    fontcolor: dt?.values?.fontcolor ?? '#ffffff',
  };
}

function storedSectionToEditor(s: StoredSection): EditorSection {
  if (s.type === 'form') return formSectionFrom(s);

  if (s.type === 'color_background') return colorSectionFrom(s);

  if (s.type === 'image_background') return imageSectionFrom(s);

  return videoSectionFrom(s);
}

export function toEditorState(template: Template | null): EditorState {
  if (!template) {
    return {
      id: makeTemplateId(),
      name: '',
      description: '',
      orientation: 'landscape',
      musicEnabled: false,
      music: null,
      sections: [newSection('video')],
    };
  }

  // Re-hydrate a stored template into the editor model (best-effort for the bounded set).
  const sections: EditorSection[] = (template.descriptor.sections ?? []).map(storedSectionToEditor);

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    orientation: template.orientation,
    musicEnabled: Boolean(template.descriptor.global?.musicEnabled),
    music: choiceFromUrl(template.descriptor.global?.music?.url, 'music'),
    sections: sections.length > 0 ? sections : [newSection('video')],
  };
}
