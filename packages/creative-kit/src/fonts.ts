// Curated TTF font library for the overlay-text editor, shared by web + expo.
// The .ttf files live under ./library/fonts and are copied into each
// app's static dir by scripts/copy-core-assets.mjs at build/dev time.
export interface FontEntry {
  id: string;
  label: string;
  file: string;
  cssFamily: string;
}

export const FONTS: FontEntry[] = [
  { id: 'rubik', label: 'Rubik', file: 'Rubik.ttf', cssFamily: 'Rubik' },
  { id: 'oswald', label: 'Oswald', file: 'Oswald.ttf', cssFamily: 'Oswald' },
  { id: 'bebas', label: 'Bebas Neue', file: 'BebasNeue.ttf', cssFamily: 'Bebas Neue' },
  { id: 'playfair', label: 'Playfair Display', file: 'PlayfairDisplay.ttf', cssFamily: 'Playfair Display' },
  { id: 'pacifico', label: 'Pacifico', file: 'Pacifico.ttf', cssFamily: 'Pacifico' },
  { id: 'mono', label: 'Roboto Mono', file: 'RobotoMono.ttf', cssFamily: 'Roboto Mono' },
  { id: 'anton', label: 'Anton', file: 'Anton.ttf', cssFamily: 'Anton' },
  { id: 'archivo-black', label: 'Archivo Black', file: 'ArchivoBlack.ttf', cssFamily: 'Archivo Black' },
  { id: 'bungee', label: 'Bungee', file: 'Bungee.ttf', cssFamily: 'Bungee' },
  { id: 'abril-fatface', label: 'Abril Fatface', file: 'AbrilFatface.ttf', cssFamily: 'Abril Fatface' },
  { id: 'righteous', label: 'Righteous', file: 'Righteous.ttf', cssFamily: 'Righteous' },
  { id: 'lobster', label: 'Lobster', file: 'Lobster.ttf', cssFamily: 'Lobster' },
];

export const findFont = (id: string): FontEntry | undefined => FONTS.find((f) => f.id === id);
export const DEFAULT_FONT_ID = 'rubik';
