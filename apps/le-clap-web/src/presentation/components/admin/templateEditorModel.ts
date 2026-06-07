import type { Template } from '@/services/templateService'
import type { TemplateDescriptor } from '@ffmpeg-video-composer/core'

// --- Editor-friendly section model (flattened; compiled to a descriptor on save) ---
export type FormField = { name: string; label: string; maxLength: number }
export type EditorSection =
  | { kind: 'form'; fields: FormField[] }
  | { kind: 'video'; duration: number; mute: boolean; text: string; fontsize: number; fontcolor: string }
  | { kind: 'color'; duration: number; color: string }

export interface EditorState {
  id: string
  name: string
  description: string
  orientation: 'landscape' | 'portrait'
  musicEnabled: boolean
  sections: EditorSection[]
}

export const SECTION_LABELS: Record<EditorSection['kind'], string> = {
  form: 'Form fields',
  video: 'Your video',
  color: 'Color background',
}

export function newSection(kind: EditorSection['kind']): EditorSection {
  if (kind === 'form') return { kind: 'form', fields: [{ name: 'firstname', label: 'Your name', maxLength: 40 }] }

  if (kind === 'color') return { kind: 'color', duration: 3, color: '#7C83FD' }

  return { kind: 'video', duration: 8, mute: false, text: '', fontsize: 48, fontcolor: '#ffffff' }
}

function makeTemplateId(): string {
  try {
    const uuid = globalThis.crypto.randomUUID()

    return uuid ? `user-${uuid}` : `user-${Date.now()}`
  } catch {
    return `user-${Date.now()}`
  }
}

// Pure: editor state -> a core TemplateDescriptor. project_video sections are
// numbered video_1, video_2… so uploaded files (userVideoPaths keys) map to them.
export function buildDescriptor(state: EditorState): TemplateDescriptor {
  let videoIndex = 0

  const sections = state.sections.map((section, i): NonNullable<TemplateDescriptor['sections']>[number] => {
    if (section.kind === 'form') {
      return {
        name: `form_${i + 1}`,
        type: 'form',
        options: { fields: section.fields.map((f) => ({ name: f.name, maxLength: f.maxLength, label: { en: f.label } })) },
      }
    }

    if (section.kind === 'color') {
      return {
        name: `color_${i + 1}`,
        type: 'color_background',
        options: { duration: section.duration, backgroundColor: section.color },
      }
    }

    videoIndex += 1
    const filters = section.text.trim()
      ? [{
          type: 'drawtext',
          values: {
            text: { en: section.text },
            fontsize: section.fontsize,
            fontcolor: section.fontcolor,
            fontfile: 'Rubik.ttf',
            x: '(w-text_w)/2',
            y: '(h-text_h)/2',
          },
        }]
      : undefined

    return {
      name: `video_${videoIndex}`,
      type: 'project_video',
      options: { duration: section.duration, muteSection: section.mute },
      ...(filters ? { filters } : {}),
    }
  })

  return { global: { orientation: state.orientation, musicEnabled: state.musicEnabled, transitionDuration: 0.5 }, sections }
}

type StoredSection = NonNullable<TemplateDescriptor['sections']>[number]

function formSectionFrom(s: StoredSection): EditorSection {
  const fields = (s.options?.fields ?? []) as Array<{ name: string; maxLength?: number; label?: Record<string, string> }>

  return { kind: 'form', fields: fields.map((f) => ({ name: f.name, label: f.label?.en ?? f.name, maxLength: f.maxLength ?? 40 })) }
}

function colorSectionFrom(s: StoredSection): EditorSection {
  return { kind: 'color', duration: s.options?.duration ?? 3, color: s.options?.backgroundColor ?? '#7C83FD' }
}

function videoSectionFrom(s: StoredSection): EditorSection {
  const dt = (s.filters ?? []).find((f) => f.type === 'drawtext')

  return {
    kind: 'video',
    duration: s.options?.duration ?? 8,
    mute: Boolean(s.options?.muteSection),
    text: dt?.values?.text?.en ?? '',
    fontsize: Number(dt?.values?.fontsize ?? 48),
    fontcolor: dt?.values?.fontcolor ?? '#ffffff',
  }
}

function storedSectionToEditor(s: StoredSection): EditorSection {
  if (s.type === 'form') return formSectionFrom(s)

  if (s.type === 'color_background') return colorSectionFrom(s)

  return videoSectionFrom(s)
}

export function toEditorState(template: Template | null): EditorState {
  if (!template) {
    return {
      id: makeTemplateId(),
      name: '',
      description: '',
      orientation: 'landscape',
      musicEnabled: false,
      sections: [newSection('video')],
    }
  }

  // Re-hydrate a stored template into the editor model (best-effort for the bounded set).
  const sections: EditorSection[] = (template.descriptor.sections ?? []).map(storedSectionToEditor)

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    orientation: template.orientation,
    musicEnabled: Boolean(template.descriptor.global?.musicEnabled),
    sections: sections.length > 0 ? sections : [newSection('video')],
  }
}
