// Expo media catalog: re-exports shared metadata from core and maps each
// catalog entry to its Metro-bundled asset module (a number resolved at
// compile time by Metro via require()).
//
// Metro requires STATIC require() calls — the path cannot be constructed from
// a variable. Every catalog file therefore gets its own explicit entry below.

import {
  MUSIC_LIBRARY,
  BACKGROUND_LIBRARY,
  findMusic,
  findBackground,
  type MediaCredit,
} from '../../../../packages/ffmpeg-video-composer/src/shared/library/catalog';

export { MUSIC_LIBRARY, BACKGROUND_LIBRARY, findMusic, findBackground, type MediaCredit };

// Metro asset modules. The `number` type comes from Metro's asset resolver:
// require('*.mp3') / require('*.jpg') returns an opaque asset id that
// expo-asset's Asset.fromModule() resolves to a file:// URI at runtime.

// prettier-ignore
export const MUSIC_ASSETS: Record<string, number> = {
  'air-prelude.mp3':            require('../../assets/musics/air-prelude.mp3'),
  'americana.mp3':              require('../../assets/musics/americana.mp3'),
  'anxiety.mp3':                require('../../assets/musics/anxiety.mp3'),
  'arcadia.mp3':                require('../../assets/musics/arcadia.mp3'),
  'autumn-day.mp3':             require('../../assets/musics/autumn-day.mp3'),
  'beachfront-celebration.mp3': require('../../assets/musics/beachfront-celebration.mp3'),
  'go-by-ocean.mp3':            require('../../assets/musics/go-by-ocean.mp3'),
};

// prettier-ignore
export const BACKGROUND_ASSETS: Record<string, number> = {
  'desk-flatlay.jpg': require('../../assets/backgrounds/desk-flatlay.jpg'),
  'forest-sea.jpg':   require('../../assets/backgrounds/forest-sea.jpg'),
  'golden-hour.jpg':  require('../../assets/backgrounds/golden-hour.jpg'),
  'green-forest.jpg': require('../../assets/backgrounds/green-forest.jpg'),
  'laptop-desk.jpg':  require('../../assets/backgrounds/laptop-desk.jpg'),
  'rocky-coast.jpg':  require('../../assets/backgrounds/rocky-coast.jpg'),
};

export const musicAsset = (id: string): number | undefined => {
  const f = findMusic(id)?.file;

  return f ? MUSIC_ASSETS[f] : undefined;
};

export const backgroundAsset = (id: string): number | undefined => {
  const f = findBackground(id)?.file;

  return f ? BACKGROUND_ASSETS[f] : undefined;
};
