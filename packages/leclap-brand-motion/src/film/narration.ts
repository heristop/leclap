import type { Lang } from './lang.tsx';

/**
 * The language each cut is narrated in. The French cuts keep the English narration: French on screen and
 * in the captions, the English voice underneath (the user's call — a French read never sounded natural).
 * Plain .ts, not .tsx, so the Node side (audio/, media/, render-film.ts) can import it at runtime too.
 */
export const NARRATION = { en: 'en', fr: 'en' } as const satisfies Record<Lang, Lang>;

export type NarrationLang = (typeof NARRATION)[Lang];
