import type { TemplateDescriptor } from 'ffmpeg-video-composer';

// SectionOptions from core omits pictureUrl at the type level; cast locally for image_background access.
type ImageBackgroundOptions = NonNullable<TemplateDescriptor['sections']>[number]['options'] & {
  pictureUrl?: string;
};

/**
 * Injects server-side music and background choices into the descriptor in place.
 *
 * Music: caller writes the uploaded file to requestTempDir/musics/<musicName>.mp3 before
 * calling compile; MusicComposer.loadMusic() stat-checks that path and cache-hits on it
 * (assetsDir = requestTempDir, getAssetsPath('musics') = requestTempDir/musics).
 *
 * Background: sets pictureUrl to the absolute local path on every image_background section.
 * FilesystemNodeAdapter.fetch() handles absolute paths by fs.copyFile to a temp location,
 * so AssetManager resolves it without any HTTP round-trip.
 *
 * Pure descriptor mutation — no filesystem I/O.
 */
export function applyServerMedia(
  descriptor: TemplateDescriptor,
  opts: { musicName?: string; backgroundPath?: string }
): void {
  if (opts.musicName) {
    descriptor.global ??= {};
    descriptor.global.music = { name: opts.musicName };
    descriptor.global.musicEnabled = true;
  }

  if (opts.backgroundPath) {
    for (const section of descriptor.sections ?? []) {
      if (section.type === 'image_background') {
        section.options = { ...section.options, pictureUrl: opts.backgroundPath } as ImageBackgroundOptions;
      }
    }
  }
}
