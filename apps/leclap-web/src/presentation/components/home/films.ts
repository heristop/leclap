// The two LeClap films on the home page, rendered in the private leclap-brand-motion repo (`render-film.ts --film
// <id> --lang <lang>`) and exported for the web under public/videos/films: one MP4 per language, with a
// poster and WebVTT captions. French visitors get the French cut; every other locale gets the English one.
export type FilmId = 'showcase' | 'agentic';
export type FilmLang = 'en' | 'fr';

export interface FilmAsset {
  mp4: string;
  poster: string;
  captions: string;
}

export const filmLang = (language: string | undefined): FilmLang => (language?.startsWith('fr') ? 'fr' : 'en');

export const filmAsset = (id: FilmId, language: string | undefined): FilmAsset => {
  const base = `/videos/films/leclap-${id}.${filmLang(language)}`;

  return { mp4: `${base}.mp4`, poster: `${base}.webp`, captions: `${base}.vtt` };
};
