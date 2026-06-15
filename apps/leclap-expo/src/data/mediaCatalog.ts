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
} from '@leclap/creative-kit/media';

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

// Template drawtext fonts, keyed by the .ttf filename the core references. Staged into the on-device
// assets dir before compile so the engine resolves them locally (the Google Fonts download can't
// handle multi-word families like "Bebas Neue" derived from a `BebasNeue.ttf` filename).
// prettier-ignore
export const FONT_ASSETS: Record<string, number> = {
  'AbrilFatface.ttf':    require('../../assets/fonts/AbrilFatface.ttf'),
  'Anton.ttf':           require('../../assets/fonts/Anton.ttf'),
  'ArchivoBlack.ttf':    require('../../assets/fonts/ArchivoBlack.ttf'),
  'BebasNeue.ttf':       require('../../assets/fonts/BebasNeue.ttf'),
  'Bungee.ttf':          require('../../assets/fonts/Bungee.ttf'),
  'Lobster.ttf':         require('../../assets/fonts/Lobster.ttf'),
  'Oswald.ttf':          require('../../assets/fonts/Oswald.ttf'),
  'Pacifico.ttf':        require('../../assets/fonts/Pacifico.ttf'),
  'PlayfairDisplay.ttf': require('../../assets/fonts/PlayfairDisplay.ttf'),
  'Righteous.ttf':       require('../../assets/fonts/Righteous.ttf'),
  'RobotoMono.ttf':      require('../../assets/fonts/RobotoMono.ttf'),
  'Rubik.ttf':           require('../../assets/fonts/Rubik.ttf'),
};

// Videos a template references by a canonical asset URL (descriptor `options.videoUrl`). Bundled and
// staged into the assets dir before compile so the engine resolves them locally instead of
// downloading the canonical URL (which 404s on-device → an HTML page → AVERROR_INVALIDDATA).
// Only the brand bumpers are bundled; sample clips stay web-only to keep the binary small.
export const VIDEO_ASSETS: Record<string, number> = {
  'leclap_bumper.mp4': require('../../assets/videos/leclap_bumper.mp4'),
  'leclap_bumper_portrait.mp4': require('../../assets/videos/leclap_bumper_portrait.mp4'),
};

export const musicAsset = (id: string): number | undefined => {
  const f = findMusic(id)?.file;

  return f ? MUSIC_ASSETS[f] : undefined;
};

export const backgroundAsset = (id: string): number | undefined => {
  const f = findBackground(id)?.file;

  return f ? BACKGROUND_ASSETS[f] : undefined;
};
