import {
  MUSIC_LIBRARY as CORE_MUSIC,
  BACKGROUND_LIBRARY as CORE_BG,
  type MediaCredit as CoreMediaCredit,
} from '@leclap/creative-kit/media';

export type MediaCredit = CoreMediaCredit & {
  url: string; // same-origin path under /public, derived from `file`
  cover?: string; // optional cover-art image URL; the music card falls back to a generated cover
};

export const MUSIC_LIBRARY: MediaCredit[] = CORE_MUSIC.map((m) => ({ ...m, url: `/musics/${m.file}` }));
export const BACKGROUND_LIBRARY: MediaCredit[] = CORE_BG.map((m) => ({ ...m, url: `/backgrounds/${m.file}` }));

export const findMusic = (id: string): MediaCredit | undefined => MUSIC_LIBRARY.find((m) => m.id === id);
export const findBackground = (id: string): MediaCredit | undefined => BACKGROUND_LIBRARY.find((m) => m.id === id);
export const findMusicByUrl = (url: string): MediaCredit | undefined => MUSIC_LIBRARY.find((m) => m.url === url);
export const findBackgroundByUrl = (url: string): MediaCredit | undefined =>
  BACKGROUND_LIBRARY.find((m) => m.url === url);
