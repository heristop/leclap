# LeClap

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.x-brightgreen.svg)](https://nodejs.org/en/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**LeClap** is a monorepo for template-driven video composition. A JSON template describes a video — sections, filters, music, overlays — and the engine compiles it into a finished video with FFmpeg. The same engine runs on **Node.js**, in the **browser** (WebAssembly), and in **React Native**.

At its heart is the [`ffmpeg-video-composer`](packages/ffmpeg-video-composer) library (published to npm and usable on its own), wrapped by an HTTP server and demonstrated by web and mobile apps.

## 🎥 Demo

Check out the video sample to see `ffmpeg-video-composer` in action (unmute for sound):

https://github.com/heristop/assets/6bcd0578-7dee-4630-aa6b-c730cf5cec17

[View the template descriptor](https://github.com/heristop/ffmpeg-video-composer/blob/main/packages/ffmpeg-video-composer/src/shared/templates/sample.json)

## 📦 Monorepo Structure

pnpm workspaces (`apps/*`, `packages/*`) — no turbo/nx. The repo root is a private orchestrator (`le-clap`); only `ffmpeg-video-composer` is published.

| Package                 | Path                             | Description                                                                         |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| `le-clap` _(private)_   | `.`                              | Workspace root — shared dev tooling (`vp`, vitest) and orchestration scripts only.  |
| `ffmpeg-video-composer` | `packages/ffmpeg-video-composer` | **The library** — cross-platform composition engine + CLI. Node, browser, and WASM. |
| `@le-clap/server`       | `packages/server`                | Fastify HTTP server exposing `/compile`, `/templates`, `/health`.                   |
| `@le-clap/web`          | `apps/le-clap-web`               | React 19 + Vite + Tailwind web app — runs FFmpeg entirely in-browser via WASM.      |
| `@le-clap/expo`         | `apps/le-clap-expo`              | Expo / React Native app — Tamagui UI, offline-first (Zustand + AsyncStorage).       |

The server and web app depend on `ffmpeg-video-composer` as a workspace package; the mobile app talks to the server.

## 🚀 Features

- ✅ **Cross-platform FFmpeg support** (Node.js, Browser, React Native ready)
- ✅ **Automatic FFmpeg detection** with ordered fallbacks
- ✅ **Optional static FFmpeg bundling** for zero-configuration setup
- ✅ **Browser support via WebAssembly** (no server required)
- ✅ Dynamic video and audio template generation
- ✅ Easy video compilation and audio mixing using FFmpeg
- ✅ Flexible JSON-based template descriptor system
- ✅ CLI for quick video creation
- ✅ JSON configuration for complex project setups
- ✅ Custom project configurations support
- ✅ Audio overlay and mixing capabilities
- ✅ Automated video editing and composition

## 🌍 Platform Support

The `ffmpeg-video-composer` library provides **FFmpeg support** across multiple platforms with automatic fallbacks.

### **Automatic FFmpeg Detection**

The library automatically detects and uses the best available FFmpeg implementation:

1. **🖥️ System FFmpeg** (best performance) - Uses your installed FFmpeg binary
2. **📦 Static FFmpeg** (fallback) - Uses bundled FFmpeg binary via `ffmpeg-static`
3. **🌐 WebAssembly FFmpeg** (browser) - Uses FFmpeg compiled to WebAssembly
4. **❌ No FFmpeg** - Provides clear installation instructions

### **Supported Environments**

- ✅ **Node.js** - Full FFmpeg support with system or static binaries
- ✅ **Browsers** - WebAssembly-based video processing (2GB file limit)
- ✅ **React Native** - Architecture ready (requires `ffmpeg-kit-react-native`)
- ✅ **Electron** - Works with both Node.js and browser implementations

## 📥 Using the Library

Install `ffmpeg-video-composer` in your own project:

### **Basic Installation (Recommended)**

```bash
pnpm install ffmpeg-video-composer
```

The package will automatically detect and use available FFmpeg implementations.

### **With Static FFmpeg (Zero Configuration)**

For environments without system FFmpeg or as a reliable fallback:

```bash
pnpm install ffmpeg-video-composer ffmpeg-static
```

### **For Browser Use**

To enable client-side video processing in browsers:

```bash
pnpm install ffmpeg-video-composer @ffmpeg/ffmpeg @ffmpeg/util
```

### **System FFmpeg via mise (Recommended)**

The recommended way to install FFmpeg for this project is [mise](https://mise.jdx.dev), which installs a pinned, full-featured build (with the `drawtext` filter and `ffprobe`) defined in [`mise.toml`](mise.toml):

```bash
mise install
```

This works cross-platform (macOS, Linux, Windows) and keeps every contributor and CI on the same FFmpeg version.

> ⚠️ **Homebrew note:** Homebrew split its formula — the regular `brew install ffmpeg` no longer bundles `libfreetype`, so the `drawtext` filter is **missing** and text/intertitle segments fail. Use mise (above), or `brew install ffmpeg-full` if you prefer Homebrew.

#### Other package managers

```bash
# Linux (Debian/Ubuntu)
sudo apt update && sudo apt install ffmpeg

# Linux (Fedora)
sudo dnf install ffmpeg
```

#### Verify Installation

```bash
ffmpeg -version
ffprobe -version
ffmpeg -hide_banner -filters | grep drawtext   # must list the drawtext filter
```

### **Node.js Usage**

```javascript
import { compile, loadConfig } from 'ffmpeg-video-composer';

const projectConfig = {
  buildDir: './build', // Build directory for output files
  assetsDir: './assets', // Assets directory for video segments
  currentLocale: 'en',
  fields: {
    form_1_firstname: 'Firstname',
    form_1_lastname: 'Lastname',
  },
};

// Using a template descriptor object
const result = await compile(projectConfig, {
  global: {
    // ... (template global configuration)
  },
  sections: [
    // ... (template sections configurations)
  ],
});

// Or using a JSON file
const template = await loadConfig('./my-template.json');
const result = await compile(projectConfig, template);
```

## 🛠️ Developing in the Monorepo

Clone the repo and install once at the root — pnpm wires every workspace package together:

```bash
git clone https://github.com/heristop/ffmpeg-video-composer.git
cd ffmpeg-video-composer
mise install   # installs the pinned FFmpeg (drawtext + ffprobe enabled)
pnpm install
```

> Requires **pnpm 11.5.2** (pinned via `packageManager`) and **Node ≥ 22.14.0** (`engine-strict` rejects wrong versions). If you don't have mise yet, see [mise installation](https://mise.jdx.dev/getting-started.html). Once activated in your shell, the project FFmpeg is automatically placed on your `PATH` when you `cd` into the repo; otherwise prefix commands with `mise exec --`, e.g. `mise exec -- pnpm test`.

Tooling is **vite-plus (`vp`)** — there is no eslint, prettier, or root jest (jest lives only inside the Expo app).

| Task          | Command                                                           |
| ------------- | ----------------------------------------------------------------- |
| Build all     | `pnpm build`                                                      |
| Test          | `pnpm test` · UI: `pnpm test:ui` · coverage: `pnpm test:coverage` |
| Lint / format | `pnpm lint` · `pnpm fmt` (check: `pnpm fmt:check`)                |
| All checks    | `pnpm check`                                                      |
| Web app       | `pnpm playground:web`                                             |
| Mobile app    | `pnpm playground:start` (also `:ios` / `:android`)                |
| Server        | `pnpm server:dev`                                                 |

### Command Line Interface

Compile a template from the repo root (output lands in `build/`):

```bash
pnpm compile packages/ffmpeg-video-composer/src/shared/templates/sample.json
```

This generates `sample_output.mp4` in the `build` directory.

## 🚨 Troubleshooting

### **"No FFmpeg implementation found"**

1. **Install FFmpeg via mise** (recommended):

   ```bash
   mise install
   ```

2. **Or install static FFmpeg**:

   ```bash
   pnpm install ffmpeg-static
   ```

3. **For browsers, install WebAssembly FFmpeg**:

   ```bash
   pnpm install @ffmpeg/ffmpeg @ffmpeg/util
   ```

### **"No such filter: 'drawtext'"**

Your FFmpeg was built without `libfreetype`, so the text/intertitle/background-color segments fail. This is common with Homebrew's split `ffmpeg` formula.

```bash
mise install                 # recommended: installs a full build with drawtext
# or, if you use Homebrew directly:
brew install ffmpeg-full
```

### **Performance Issues**

- **System FFmpeg** → Fastest (recommended for production)
- **Static FFmpeg** → Good performance, larger bundle size
- **WebAssembly** → Slower, suitable for demos and client-side apps

## 🧪 Running Tests

The tests render real video segments, so a `drawtext`-capable FFmpeg must be on your `PATH` — run `mise install` first (see [Developing in the Monorepo](#️-developing-in-the-monorepo)):

```bash
pnpm test
# or, if mise is not activated in your shell:
mise exec -- pnpm test
```

## 📱 LeClap Expo App

The `@le-clap/expo` client (`apps/le-clap-expo`) provides a mobile interface for the video composer workflow on device or simulator.

<img src="https://github.com/heristop/ffmpeg-video-composer/raw/main/docs/leclap.gif" alt="LeClap App" width="300" />

### Starting the Server

Before using the mobile app, start the server it talks to:

```bash
pnpm server:dev
```

This builds and starts `@le-clap/server`, which the mobile client communicates with.

### Running the App

```bash
pnpm playground:start          # start the Expo dev server
pnpm playground:android        # run on Android
pnpm playground:ios            # run on iOS
```

## 🌐 LeClap Web App

The `@le-clap/web` client (`apps/le-clap-web`) — React 19 + Vite + Tailwind — runs FFmpeg **entirely in the browser** via WebAssembly, with no server required (2 GB input limit).

```bash
pnpm playground:web
```

This starts the Vite dev server; open the printed URL to compose videos client-side.

## 📚 Documentation

- **[🏗 Architecture](docs/architecture.md)** - Detailed system architecture and design patterns
- **[📋 Template Schema](docs/template-schema.md)** - Complete JSON schema documentation for video templates
- **[🔧 FFmpeg Fallback Strategy](docs/ffmpeg-fallback-strategy.md)** - How automatic FFmpeg detection works
- **[🤖 AGENTS.md](AGENTS.md)** - Repo layout, commands, and conventions for contributors and AI agents

## 🔍 Diagnostics & Troubleshooting

Run system diagnostics to check your setup:

```bash
pnpm diagnose
```

This analyzes your system and provides personalized recommendations for optimal performance. The library automatically detects and uses the best available FFmpeg implementation, so manual configuration is rarely needed.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

If you have any questions or feedback, please open an issue on GitHub.
