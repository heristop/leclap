import { describe, it, expect } from 'vitest'
import { buildDescriptor, toEditorState, newSection, type EditorState } from './templateEditorModel'
import { MUSIC_LIBRARY, BACKGROUND_LIBRARY } from '@/data/mediaCatalog'
import type { Template } from '@/services/templateService'

function baseState(over: Partial<EditorState> = {}): EditorState {
  return {
    id: 'user-1', name: 'T', description: '', orientation: 'landscape',
    musicEnabled: false, music: null, sections: [newSection('video')], ...over,
  }
}

function asTemplate(state: EditorState): Template {
  return {
    id: state.id, name: state.name, description: state.description, orientation: state.orientation,
    hasForm: false, complexity: 'simple', source: 'user', descriptor: buildDescriptor(state),
  }
}

describe('templateEditorModel media', () => {
  it('builds global.music for a library pick when music is enabled', () => {
    const lib = MUSIC_LIBRARY[0]
    const d = buildDescriptor(baseState({ musicEnabled: true, music: { source: 'library', id: lib.id } }))

    expect(d.global?.musicEnabled).toBe(true)
    expect(d.global?.music).toEqual({ name: lib.id, url: lib.url })
  })

  it('builds a media:// sentinel for an uploaded track', () => {
    const d = buildDescriptor(baseState({ musicEnabled: true, music: { source: 'upload', key: 'k1', label: 'a.mp3' } }))

    expect(d.global?.music).toEqual({ name: 'k1', url: 'media://k1' })
  })

  it('omits global.music when music is disabled', () => {
    const d = buildDescriptor(baseState({ musicEnabled: false, music: { source: 'upload', key: 'k1', label: 'a.mp3' } }))

    expect(d.global?.music).toBeUndefined()
  })

  it('builds an image_background section for a library background', () => {
    const bg = BACKGROUND_LIBRARY[0] ?? { id: 'x', url: '/backgrounds/x.jpg' }
    const d = buildDescriptor(baseState({
      sections: [{ kind: 'image', duration: 4, background: { source: 'library', id: bg.id } }],
    }))

    expect(d.sections?.[0]).toMatchObject({
      name: 'image_1', type: 'image_background', options: { duration: 4, pictureUrl: bg.url },
    })
  })

  it('round-trips an uploaded image and a library track through a stored template', () => {
    const lib = MUSIC_LIBRARY[0]
    const start = baseState({
      musicEnabled: true,
      music: { source: 'library', id: lib.id },
      sections: [{ kind: 'image', duration: 6, background: { source: 'upload', key: 'imgK', label: 'p.png' } }],
    })

    const back = toEditorState(asTemplate(start))

    expect(back.musicEnabled).toBe(true)
    expect(back.music).toEqual({ source: 'library', id: lib.id })
    expect(back.sections[0]).toMatchObject({ kind: 'image', duration: 6 })
    expect(back.sections[0]).toMatchObject({ background: { source: 'upload', key: 'imgK' } })
  })
})
