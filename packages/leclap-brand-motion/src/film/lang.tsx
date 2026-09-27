import { createContext, useContext, type ReactNode } from 'react';

// The films' language. Every on-screen string sits in its film's copy.ts, and every narration line in its
// voice-lines.ts, as `{ en, fr }` side by side — so a line missing its translation fails typecheck. The
// composition takes `lang` as a prop (Root.tsx registers an English and a French id per film), provides
// it here, and the scenes read their copy through `useT()`.
//
// Only types leave this file for the Node scripts (audio/, media/): Node strips types but can't run TSX.

export type Lang = 'en' | 'fr';

/** One string in every film language. */
export type Bilingual = Record<Lang, string>;

/** Any other per-language value: a type size, a list of highlighted words, a frame cued off the voice. */
export type PerLang<T> = Readonly<Record<Lang, T>>;

/** What a copy module is made of: sections of bilingual strings and per-language values, at any depth. */
export interface CopyTree {
  readonly [key: string]: Bilingual | PerLang<number> | PerLang<readonly string[]> | readonly Bilingual[] | CopyTree;
}

const LangContext = createContext<Lang>('en');

export const LangProvider = ({ lang, children }: { lang: Lang; children: ReactNode }) => (
  <LangContext value={lang}>{children}</LangContext>
);

export const useLang = (): Lang => useContext(LangContext);

/** The copy picker: `t(COPY.title.tagline)` is the tagline in the film's language. */
export const useT = (): ((s: Bilingual) => string) => {
  const lang = useLang();

  return (s) => s[lang];
};
