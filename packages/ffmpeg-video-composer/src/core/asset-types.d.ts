// Media and asset bookkeeping types, split out of `types.d.ts` for its max-lines budget and re-exported
// from there.

export type Media = {
  name: string;
  url?: string;
  path?: string;
  extension?: string;
};

export type TemplateAssets = {
  fonts: Record<string, string>;
  musics: Record<string, string>;
  inputs: string[];
};
