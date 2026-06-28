// The curated TTF font registry is the engine's single source of truth (id → file mapping, used for
// font validation and on-demand fetch). Re-exported here so the web/expo editors keep importing
// `@leclap/creative-kit/fonts`. The .ttf files live under ./library/fonts and are copied into each
// app's static dir by scripts/copy-core-assets.ts at build/dev time.
export * from 'ffmpeg-video-composer/src/core/fonts.ts';
