# le-clap

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.x-brightgreen.svg)](https://nodejs.org/en/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**le-clap** is the monorepo for this project: it contains the published [`ffmpeg-video-composer`](packages/ffmpeg-video-composer) library plus the le-clap web and mobile apps that build on it.

`ffmpeg-video-composer` is a tool for video compilation and audio mixing using FFmpeg. It supports dynamic template generation, video rendering, and audio composition for creating personalized multimedia content programmatically.

## 🎥 Demo

Check out the video sample to see `ffmpeg-video-composer` in action (unmute for sound):

https://github.com/heristop/assets/6bcd0578-7dee-4630-aa6b-c730cf5cec17

[View the template descriptor](https://github.com/heristop/ffmpeg-video-composer/blob/main/packages/ffmpeg-video-composer/src/shared/templates/sample.json)

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

This package provides **FFmpeg support** across multiple platforms with automatic fallbacks:

### **Automatic FFmpeg Detection**

The package automatically detects and uses the best available FFmpeg implementation:

1. **🖥️ System FFmpeg** (best performance) - Uses your installed FFmpeg binary
2. **📦 Static FFmpeg** (fallback) - Uses bundled FFmpeg binary via `ffmpeg-static`
3. **🌐 WebAssembly FFmpeg** (browser) - Uses FFmpeg compiled to WebAssembly
4. **❌ No FFmpeg** - Provides clear installation instructions

### **Supported Environments**

- ✅ **Node.js** - Full FFmpeg support with system or static binaries
- ✅ **Browsers** - WebAssembly-based video processing (2GB file limit)
- ✅ **React Native** - Architecture ready (requires `ffmpeg-kit-react-native`)
- ✅ **Electron** - Works with both Node.js and browser implementations

## 📦 Installation Options

### **Basic Installation (Recommended)**

```bash
npm install ffmpeg-video-composer
```

The package will automatically detect and use available FFmpeg implementations.

### **With Static FFmpeg (Zero Configuration)**

For environments without system FFmpeg or as a reliable fallback:

```bash
npm install ffmpeg-video-composer ffmpeg-static
```

### **For Browser Use**

To enable client-side video processing in browsers:

```bash
npm install ffmpeg-video-composer @ffmpeg/ffmpeg @ffmpeg/util
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

## 🛠️ Development Setup

This repository uses [mise](https://mise.jdx.dev) to install and pin a full-featured FFmpeg (the version is declared in [`mise.toml`](mise.toml)). This guarantees the `drawtext` filter and `ffprobe` are available, which the test suite and text/intertitle segments require.

```bash
git clone https://github.com/heristop/ffmpeg-video-composer.git
cd ffmpeg-video-composer
mise install   # installs the pinned FFmpeg (drawtext + ffprobe enabled)
pnpm i
```

> If you don't have mise yet, see [mise installation](https://mise.jdx.dev/getting-started.html). Once activated in your shell, the project FFmpeg is automatically placed on your `PATH` when you `cd` into the repo. Otherwise prefix commands with `mise exec --`, e.g. `mise exec -- pnpm test`.

## 📖 Usage

### **Command Line Interface**

```bash
   pnpm compile packages/ffmpeg-video-composer/src/shared/templates/sample.json
```

This generates `sample_output.mp4` in the `build` directory.

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
const template = await loadConfig('./packages/ffmpeg-video-composer/src/shared/templates/sample.json');
const result = await compile(projectConfig, template);
```

## 🚨 Troubleshooting

### **"No FFmpeg implementation found"**

1. **Install FFmpeg via mise** (recommended):

   ```bash
   mise install
   ```

2. **Or install static FFmpeg**:

   ```bash
   npm install ffmpeg-static
   ```

3. **For browsers, install WebAssembly FFmpeg**:

   ```bash
   npm install @ffmpeg/ffmpeg @ffmpeg/util
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

Ensure the quality of the codebase by running the test suite. The tests render real video segments, so a `drawtext`-capable FFmpeg must be on your `PATH` — run `mise install` first (see [Development Setup](#️-development-setup)):

```bash
pnpm test
# or, if mise is not activated in your shell:
mise exec -- pnpm test
```

## 📱 LeClap Expo App

The repository includes an Expo client (`apps/le-clap-expo`) that provides a mobile interface for the video composer workflow on device or simulator.

<img src="https://github.com/heristop/ffmpeg-video-composer/raw/main/docs/leclap.gif" alt="LeClap App" width="300" />

### Starting the Server

Before using the mobile app, you need to start the server:

```bash
pnpm server:dev
```

This command builds and starts the server that the mobile client will communicate with.

### Running the App

To start the Expo development server:

```bash
pnpm playground:start
```

To run the app on specific platforms:

```bash
# Run on Android
pnpm playground:android

# Run on iOS
pnpm playground:ios
```

## 🌐 LeClap Web App

The repository also includes a web client (`apps/le-clap-web`) — React 19 + Vite + Tailwind — that runs FFmpeg **entirely in the browser** via WebAssembly, with no server required (2 GB input limit).

```bash
pnpm playground:web
```

This starts the Vite dev server; open the printed URL to compose videos client-side.

## 📚 Documentation

- **[🏗 Architecture](docs/architecture.md)** - Detailed system architecture and design patterns
- **[📋 Template Schema](docs/template-schema.md)** - Complete JSON schema documentation for video templates
- **[🔧 FFmpeg Fallback Strategy](docs/ffmpeg-fallback-strategy.md)** - How automatic FFmpeg detection works

## 🔍 Diagnostics & Troubleshooting

Run system diagnostics to check your setup:

```bash
pnpm diagnose
```

This will analyze your system and provide personalized recommendations for optimal performance. The package automatically detects and uses the best available FFmpeg implementation, so manual configuration is rarely needed.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

If you have any questions or feedback, please open an issue on GitHub.
