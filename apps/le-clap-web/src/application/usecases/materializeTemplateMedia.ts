import type { TemplateDescriptor } from '@ffmpeg-video-composer/core/src/core/types.d.ts'

const PREFIX = 'media://'

export interface MediaSource {
  getBytes(key: string): Promise<Uint8Array | null>
  getMeta(key: string): Promise<{ kind: string; ext: string; name: string } | null>
}

export interface MediaTarget {
  writeFile(path: string, data: Uint8Array): Promise<void>
}

async function readOrThrow(source: MediaSource, key: string): Promise<Uint8Array> {
  const bytes = await source.getBytes(key)

  if (!bytes) {
    throw new Error('An uploaded media file is no longer available — re-select it in the template.')
  }

  return bytes
}

// SectionOptions from core omits pictureUrl; cast locally for image_background access.
type ImageBackgroundOptions = NonNullable<TemplateDescriptor['sections']>[number]['options'] & { pictureUrl?: string }

/**
 * Copies uploaded blobs (referenced as `media://<key>`) into the engine filesystem
 * and rewrites the descriptor to point at the materialized engine paths. Curated
 * URLs are left untouched. Mutates `descriptor` in place.
 */
export async function materializeTemplateMedia(
  descriptor: TemplateDescriptor,
  source: MediaSource,
  target: MediaTarget
): Promise<void> {
  const musicUrl = descriptor.global?.music?.url

  if (musicUrl?.startsWith(PREFIX) && descriptor.global?.music) {
    const key = musicUrl.slice(PREFIX.length)
    const bytes = await readOrThrow(source, key)
    await target.writeFile(`/assets/musics/${key}.mp3`, bytes)
    descriptor.global.music = { name: key }
  }

  for (const section of descriptor.sections ?? []) {
    const opts = section.options as ImageBackgroundOptions | undefined
    const url = opts?.pictureUrl

    if (section.type !== 'image_background' || !url?.startsWith(PREFIX)) {
      continue
    }

    const key = url.slice(PREFIX.length)
    const meta = await source.getMeta(key)
    const bytes = await readOrThrow(source, key)
    const path = `/assets/pictures/${key}.${meta?.ext ?? 'bin'}`
    await target.writeFile(path, bytes)
    section.options = { ...section.options, pictureUrl: path } as ImageBackgroundOptions
  }
}
