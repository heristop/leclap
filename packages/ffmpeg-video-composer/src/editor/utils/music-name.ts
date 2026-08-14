import type { MusicConfig } from '@/core/types';

/** Strip the final extension from a filename or URL basename. */
export function removeExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

// The formatted name becomes a staged FILENAME that is later interpolated unquoted into a
// space-split ffmpeg command, so whitespace/quotes in the human-readable display name
// (schema: any string, e.g. 'Epic Rise') are slugged to '_' — they would otherwise re-tokenize
// the command ('-i …/Epic' plus a stray 'Rise.mp3' argument).
function toSafeFileName(name: string): string {
  return name.replace(/[\s"']+/g, '_');
}

/** Format the staged music filename from the config's display name, else the URL's basename. */
export function formatMusicName(music: MusicConfig): string {
  if (music.name) {
    return toSafeFileName(removeExtension(music.name));
  }

  const fileName = music.url?.split('/').at(-1) ?? '';

  return toSafeFileName(removeExtension(fileName));
}
