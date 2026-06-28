// Curated TTF font registry shared by the engine (font validation + drawtext resolution) and the
// creative-kit catalog/editor. The .ttf files are NOT bundled in the package — they are fetched on
// demand from the asset source (see `asset-source.ts`); this registry only maps a stable `id` to its
// file name and display label.
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

// Look up a catalog font by its .ttf file name (used when staging fonts referenced by file).
export const findFontByFile = (file: string): FontEntry | undefined => FONTS.find((f) => f.file === file);

export const DEFAULT_FONT_ID = 'rubik';
