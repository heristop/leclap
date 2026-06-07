import { describe, it, expect, vi } from 'vitest'
import { materializeTemplateMedia, type MediaSource, type MediaTarget } from './materializeTemplateMedia'
import type { TemplateDescriptor } from '@ffmpeg-video-composer/core/src/core/types.d.ts'

function sourceWith(records: Record<string, { bytes: Uint8Array; ext: string }>): MediaSource {
  return {
    getBytes: async (k) => records[k]?.bytes ?? null,
    getMeta: async (k) => (records[k] ? { kind: 'picture', ext: records[k].ext, name: 'n' } : null),
  }
}

describe('materializeTemplateMedia', () => {
  it('writes an uploaded track and rewrites global.music to a cache name', async () => {
    const writes: Array<{ path: string; bytes: Uint8Array }> = []
    const target: MediaTarget = { writeFile: async (path, bytes) => { writes.push({ path, bytes }) } }
    const descriptor: TemplateDescriptor = { global: { music: { name: 'k1', url: 'media://k1' } }, sections: [] }

    await materializeTemplateMedia(descriptor, sourceWith({ k1: { bytes: new Uint8Array([1]), ext: 'mp3' } }), target)

    expect(writes[0].path).toBe('/assets/musics/k1.mp3')
    expect(descriptor.global?.music).toEqual({ name: 'k1' })
  })

  it('writes an uploaded image and rewrites pictureUrl to an engine path', async () => {
    const target: MediaTarget = { writeFile: vi.fn(async () => undefined) }
    const descriptor: TemplateDescriptor = {
      global: {},
      sections: [{ name: 'image_1', type: 'image_background', options: { pictureUrl: 'media://imgK' } }],
    }

    await materializeTemplateMedia(descriptor, sourceWith({ imgK: { bytes: new Uint8Array([2]), ext: 'png' } }), target)

    expect(target.writeFile).toHaveBeenCalledWith('/assets/pictures/imgK.png', new Uint8Array([2]))
    expect(descriptor.sections?.[0].options?.pictureUrl).toBe('/assets/pictures/imgK.png')
  })

  it('leaves curated URLs untouched', async () => {
    const target: MediaTarget = { writeFile: vi.fn(async () => undefined) }
    const descriptor: TemplateDescriptor = {
      global: { music: { name: 'go', url: '/musics/go.mp3' } },
      sections: [{ name: 'image_1', type: 'image_background', options: { pictureUrl: '/backgrounds/x.jpg' } }],
    }

    await materializeTemplateMedia(descriptor, sourceWith({}), target)

    expect(target.writeFile).not.toHaveBeenCalled()
    expect(descriptor.global?.music?.url).toBe('/musics/go.mp3')
  })

  it('throws a clear error when an uploaded blob is missing', async () => {
    const target: MediaTarget = { writeFile: vi.fn(async () => undefined) }
    const descriptor: TemplateDescriptor = { global: { music: { name: 'k', url: 'media://k' } }, sections: [] }

    await expect(materializeTemplateMedia(descriptor, sourceWith({}), target)).rejects.toThrow(/no longer available/)
  })
})
