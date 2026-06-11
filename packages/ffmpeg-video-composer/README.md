# ffmpeg-video-composer

**One JSON spec renders on Node, in the browser via WebAssembly, and fully on-device on React Native — no upload, no server required.**

Template-driven video composition over FFmpeg. A single JSON _template_ describes a video's structure — sections, filters, music, text overlays — and the library renders it into a finished video. The same engine runs in Node.js, in the browser (WebAssembly), and in React Native.

> Upgrading from v1? The package name is unchanged — see the [migration guide](https://github.com/heristop/ffmpeg-video-composer/blob/main/MIGRATION.md).

## Install

```bash
pnpm add ffmpeg-video-composer                            # uses your system FFmpeg
pnpm add ffmpeg-video-composer ffmpeg-static              # static binary fallback
pnpm add ffmpeg-video-composer @ffmpeg/ffmpeg @ffmpeg/util  # browser (WASM)
```

## Quick start

```javascript
import { compile, loadConfig } from 'ffmpeg-video-composer';

const projectConfig = {
  buildDir: './build',
  assetsDir: './assets',
  currentLocale: 'en',
  fields: { form_1_firstname: 'Firstname', form_1_lastname: 'Lastname' },
};

const template = await loadConfig('./my-template.json');
const result = await compile(projectConfig, template);
```

A CLI is also included:

```bash
npx ffmpeg-video-composer my-template.json   # compile a template
npx ffmpeg-video-composer --diagnose         # check your FFmpeg setup
```

## Entry points

| Import                              | Target       | Notes                                           |
| ----------------------------------- | ------------ | ----------------------------------------------- |
| `ffmpeg-video-composer`             | Node.js      | ESM + CJS, system/static FFmpeg                 |
| `ffmpeg-video-composer/browser`     | Browser      | WASM via `@ffmpeg/ffmpeg` (install it yourself) |
| `ffmpeg-video-composer/reactnative` | React Native | Pre-compiled JS; expects `expo-file-system`     |

## FFmpeg detection order

The library picks the best available FFmpeg automatically:

1. **System FFmpeg** — your installed binary (fastest, recommended for production).
2. **Static FFmpeg** — bundled binary via the optional `ffmpeg-static` package.
3. **WebAssembly** — `@ffmpeg/ffmpeg` in the browser (2 GB input limit).
4. **None** — a clear error message with installation guidance.

Run `npx ffmpeg-video-composer --diagnose` to see what your environment provides.

> Text/intertitle/background-color segments need an FFmpeg built with `libfreetype` (`drawtext` filter). Verify with `ffmpeg -hide_banner -filters | grep drawtext`.

## Templates

Templates are Zod-validated JSON descriptors: global options (size, music, locale) plus an ordered list of sections, each with `inputs → maps → filters`. See the [template configuration reference](https://github.com/heristop/ffmpeg-video-composer/blob/main/docs/template-configuration.md) and the ready-made examples in the [repository](https://github.com/heristop/ffmpeg-video-composer).

## License

MIT.

This package does **not** bundle FFmpeg. It drives an FFmpeg you provide: your system binary, the optional `ffmpeg-static` package, or `@ffmpeg/ffmpeg` (WASM) in the browser — each under its own license.

The optional on-device mobile engine (Android/iOS) lives in the monorepo, not in this package, and statically links an LGPLv3 FFmpeg built from source — see the [on-device compilation docs](https://github.com/heristop/ffmpeg-video-composer/blob/main/docs/on-device-compilation.md).
