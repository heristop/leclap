import type { Template } from '@/services/templateService';
import type { TemplateDescriptor } from '@ffmpeg-video-composer/core';

export type MediaChoice = { source: 'library'; id: string } | { source: 'upload'; key: string; label: string };

// --- Editor-friendly section model (flattened; compiled to a descriptor on save) ---
export type FormField = { name: string; label: string; maxLength: number };
export type EditorSection =
  | { kind: 'form'; fields: FormField[] }
  | { kind: 'video'; duration: number; mute: boolean; text: string; fontsize: number; fontcolor: string }
  | { kind: 'color'; duration: number; color: string }
  | { kind: 'usermusic' }
  | { kind: 'userphoto'; duration: number };

export interface EditorState {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  musicEnabled: boolean;
  allowedMusic: string[];
  backgroundEnabled: boolean;
  allowedBackgrounds: string[];
  sections: EditorSection[];
}

export const SECTION_LABELS: Record<EditorSection['kind'], string> = {
  form: 'Form fields',
  video: 'Your video',
  color: 'Color background',
  usermusic: 'Your music',
  userphoto: 'Your photo',
};

export function newSection(kind: EditorSection['kind']): EditorSection {
  if (kind === 'form') return { kind: 'form', fields: [{ name: 'firstname', label: 'Your name', maxLength: 40 }] };

  if (kind === 'color') return { kind: 'color', duration: 3, color: '#7C83FD' };

  if (kind === 'usermusic') return { kind: 'usermusic' };

  if (kind === 'userphoto') return { kind: 'userphoto', duration: 4 };

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

// Pure: editor state -> a core TemplateDescriptor. project_video sections are
// numbered video_1, video_2… so uploaded files (userVideoPaths keys) map to them.
export function buildDescriptor(state: EditorState): TemplateDescriptor {
  let videoIndex = 0;

  const hasUserMusic = state.sections.some((s) => s.kind === 'usermusic');
  const userPhoto = state.sections.find((s): s is { kind: 'userphoto'; duration: number } => s.kind === 'userphoto');

  const editorSections = state.sections
    .filter((s) => s.kind !== 'usermusic' && s.kind !== 'userphoto')
    .map((section, i): NonNullable<TemplateDescriptor['sections']>[number] => {
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

  const needsBackground = state.backgroundEnabled || userPhoto !== undefined;
  const backgroundDuration = userPhoto?.duration ?? 4;

  const backgroundSections: NonNullable<TemplateDescriptor['sections']>[number][] = needsBackground
    ? [{ name: 'background_1', type: 'image_background', options: { duration: backgroundDuration } }]
    : [];

  const sections = [...editorSections, ...backgroundSections];

  const musicOn = state.musicEnabled || hasUserMusic;

  const global: NonNullable<TemplateDescriptor['global']> = {
    orientation: state.orientation,
    musicEnabled: musicOn,
    transitionDuration: 0.5,
  };

  if (musicOn) {
    global.allowedMusic = state.allowedMusic;

    if (hasUserMusic) global.allowUploadMusic = true;
  }

  if (needsBackground) {
    global.allowedBackgrounds = state.allowedBackgrounds;

    if (userPhoto !== undefined) global.allowUploadBackground = true;
  }

  return { global, sections };
}

type StoredSection = NonNullable<TemplateDescriptor['sections']>[number];

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

function storedSectionToEditor(s: StoredSection): EditorSection | null {
  if (s.type === 'form') return formSectionFrom(s);

  if (s.type === 'color_background') return colorSectionFrom(s);

  // image_background is a background placeholder — skip it (not an editor section)
  if (s.type === 'image_background') return null;

  return videoSectionFrom(s);
}

function buildUploadSections(
  allowUploadMusic: unknown,
  allowUploadBackground: unknown,
  bgDuration: number
): EditorSection[] {
  const result: EditorSection[] = [];

  if (allowUploadMusic) result.push({ kind: 'usermusic' });

  if (allowUploadBackground) result.push({ kind: 'userphoto', duration: bgDuration });

  return result;
}

export function toEditorState(template: Template | null): EditorState {
  if (!template) {
    return {
      id: makeTemplateId(),
      name: '',
      description: '',
      orientation: 'landscape',
      musicEnabled: false,
      allowedMusic: [],
      backgroundEnabled: false,
      allowedBackgrounds: [],
      sections: [newSection('video')],
    };
  }

  const { global: g, sections: storedSections = [] } = template.descriptor;

  const allowedMusic = g?.allowedMusic ?? [];
  const musicEnabled = allowedMusic.length > 0;

  const allowedBackgrounds = g?.allowedBackgrounds ?? [];
  const backgroundEnabled = allowedBackgrounds.length > 0 || storedSections.some((s) => s.type === 'image_background');

  const bgSection = storedSections.find((s) => s.type === 'image_background');
  const bgDuration = bgSection?.options?.duration ?? 4;

  const mapped = storedSections.map(storedSectionToEditor).filter((s): s is EditorSection => s !== null);

  const uploadSections = buildUploadSections(g?.allowUploadMusic, g?.allowUploadBackground, bgDuration);

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    orientation: template.orientation,
    musicEnabled,
    allowedMusic,
    backgroundEnabled,
    allowedBackgrounds,
    sections: mapped.length + uploadSections.length > 0 ? [...mapped, ...uploadSections] : [newSection('video')],
  };
}
