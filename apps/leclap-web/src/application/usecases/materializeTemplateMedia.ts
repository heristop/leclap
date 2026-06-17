import type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';

const PREFIX = 'media://';

export interface MediaSource {
  getBytes(key: string): Promise<Uint8Array | null>;
  getMeta(key: string): Promise<{ kind: string; ext: string; name: string } | null>;
}

export interface MediaTarget {
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

async function readOrThrow(source: MediaSource, key: string): Promise<Uint8Array> {
  const bytes = await source.getBytes(key);

  if (!bytes) {
    throw new Error('An uploaded media file is no longer available — re-select it in the template.');
  }

  return bytes;
}

// SectionOptions from core omits pictureUrl; cast locally for image_background access.
type ImageBackgroundOptions = NonNullable<TemplateDescriptor['sections']>[number]['options'] & { pictureUrl?: string };

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
  const musicUrl = descriptor.global?.music?.url;

  if (musicUrl?.startsWith(PREFIX) && descriptor.global?.music) {
    const key = musicUrl.slice(PREFIX.length);
    const bytes = await readOrThrow(source, key);
    await target.writeFile(`/assets/musics/${key}.mp3`, bytes);
    descriptor.global.music = { name: key };
  }

  const uploads = (descriptor.sections ?? []).filter((section) => {
    const opts = section.options as ImageBackgroundOptions | undefined;

    return section.type === 'image_background' && (opts?.pictureUrl?.startsWith(PREFIX) ?? false);
  });

  await Promise.all(
    uploads.map(async (section) => {
      const opts = section.options as ImageBackgroundOptions;
      const key = (opts.pictureUrl ?? '').slice(PREFIX.length);
      const meta = await source.getMeta(key);
      const bytes = await readOrThrow(source, key);
      const path = `/assets/pictures/${key}.${meta?.ext ?? 'bin'}`;
      await target.writeFile(path, bytes);
      section.options = { ...section.options, pictureUrl: path } as ImageBackgroundOptions;
    })
  );

  // Uploaded images on any section's `inputs` (the video-section image overlays).
  const inputUploads = (descriptor.sections ?? []).flatMap((section) =>
    (section.inputs ?? []).filter((input) => input.url?.startsWith(PREFIX))
  );

  await Promise.all(
    inputUploads.map(async (input) => {
      const key = (input.url ?? '').slice(PREFIX.length);
      const meta = await source.getMeta(key);
      const bytes = await readOrThrow(source, key);
      const path = `/assets/pictures/${key}.${meta?.ext ?? 'bin'}`;
      await target.writeFile(path, bytes);
      input.url = path;
    })
  );
}
