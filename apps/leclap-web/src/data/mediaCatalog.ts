import {
  MUSIC_LIBRARY as CORE_MUSIC,
  BACKGROUND_LIBRARY as CORE_BG,
  type MediaCredit as CoreMediaCredit,
} from '@leclap/creative-kit/media';
import { ANIMATION_FILES } from './animations.generated';

export type MediaCredit = CoreMediaCredit & {
  url: string; // same-origin path under /public, derived from `file`
  cover?: string; // optional cover-art image URL; the music card falls back to a generated cover
};

export type AnimationAsset = { id: string; label: string; file: string; url: string };

export const MUSIC_LIBRARY: MediaCredit[] = CORE_MUSIC.map((m) => ({ ...m, url: `/musics/${m.file}` })).sort((a, b) =>
  a.title.localeCompare(b.title)
);
export const BACKGROUND_LIBRARY: MediaCredit[] = CORE_BG.map((m) => ({ ...m, url: `/backgrounds/${m.file}` }));

// The list comes from a manifest scripts/copy-core-assets generates from the creative-kit animations
// library (regenerated on web build/start). A static import is HMR-friendly and avoids a cross-package
// import.meta.glob the dev server doesn't re-scan. URLs are the stable /public/assets/animations copy,
// so a saved template descriptor keeps a portable path.
const labelFromFile = (file: string): string => {
  const base = file
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  return base.charAt(0).toUpperCase() + base.slice(1);
};

export const ANIMATION_LIBRARY: AnimationAsset[] = ANIMATION_FILES.map((file) => ({
  id: file.replace(/\.[^.]+$/, '').replace(/_/g, '-'),
  label: labelFromFile(file),
  file,
  url: `/assets/animations/${file}`,
}));

export const findMusic = (id: string): MediaCredit | undefined => MUSIC_LIBRARY.find((m) => m.id === id);
export const findBackground = (id: string): MediaCredit | undefined => BACKGROUND_LIBRARY.find((m) => m.id === id);
export const findAnimationByUrl = (url: string): AnimationAsset | undefined =>
  ANIMATION_LIBRARY.find((a) => a.url === url);
export const findMusicByUrl = (url: string): MediaCredit | undefined => MUSIC_LIBRARY.find((m) => m.url === url);
export const findBackgroundByUrl = (url: string): MediaCredit | undefined =>
  BACKGROUND_LIBRARY.find((m) => m.url === url);
