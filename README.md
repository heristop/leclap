# FFmpeg Video Composer

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.x-brightgreen.svg)](https://nodejs.org/en/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`ffmpeg-video-composer` is a tool designed to streamline the process of video compilation and audio mixing using FFmpeg. It enables dynamic template generation, video rendering, and audio composition, making it a comprehensive solution for creating personalized multimedia content programmatically.

## 🎥 Demo

Check out the video sample to see `ffmpeg-video-composer` in action (unmute for sound):

https://github.com/heristop/assets/6bcd0578-7dee-4630-aa6b-c730cf5cec17

[View the template descriptor](https://github.com/heristop/ffmpeg-video-composer/blob/main/src/shared/templates/sample.json)

## 🚀 Features

- ✅ **Cross-platform FFmpeg support** (Node.js, Browser, React Native ready)
- ✅ **Automatic FFmpeg detection** with intelligent fallbacks
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

This package provides **intelligent FFmpeg support** across multiple platforms with automatic fallback mechanisms:

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

### **Optional: System FFmpeg (Best Performance)**

For optimal performance, install FFmpeg system-wide:

#### macOS

```bash
brew install ffmpeg
```

#### Linux (Debian/Ubuntu)

```bash
sudo apt update && sudo apt install ffmpeg
```

#### Linux (Fedora)

```bash
sudo dnf install ffmpeg
```

#### Verify Installation

```bash
ffmpeg -version
ffprobe -version
```

## 🛠️ Development Setup

```bash
git clone https://github.com/heristop/ffmpeg-video-composer.git
cd ffmpeg-video-composer
pnpm i
```

## 📖 Usage

### **Command Line Interface**

```bash
pnpm compile src/shared/templates/sample.json
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
const template = await loadConfig('./src/shared/templates/sample.json');
const result = await compile(projectConfig, template);
```

## 🚨 Troubleshooting

### **"No FFmpeg implementation found"**

1. **Install system FFmpeg** (recommended):

   ```bash
   # macOS
   brew install ffmpeg

   # Linux
   sudo apt install ffmpeg
   ```

2. **Or install static FFmpeg**:

   ```bash
   npm install ffmpeg-static
   ```

3. **For browsers, install WebAssembly FFmpeg**:

   ```bash
   npm install @ffmpeg/ffmpeg @ffmpeg/util
   ```

### **Performance Issues**

- **System FFmpeg** → Fastest (recommended for production)
- **Static FFmpeg** → Good performance, larger bundle size
- **WebAssembly** → Slower, suitable for demos and client-side apps

## 🧪 Running Tests

Ensure the quality of the codebase by running the test suite:

```bash
pnpm test
```

## 📱 LeClap Expo App

The repository includes a modern Expo client (`apps/le-clap`) that provides an intuitive mobile interface for the video composer workflow on device or simulator.

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

## 📚 Documentation

- **[🏗 Architecture](docs/architecture.md)** - Detailed system architecture and design patterns
- **[📋 Template Schema](docs/template-schema.md)** - Complete JSON schema documentation for video templates
- **[🔧 FFmpeg Fallback Strategy](docs/ffmpeg-fallback-strategy.md)** - How automatic FFmpeg detection works

## 🔍 Diagnostics & Troubleshooting

Run comprehensive system diagnostics to check your setup:

```bash
pnpm diagnose
```

This will analyze your system and provide personalized recommendations for optimal performance. The package automatically detects and uses the best available FFmpeg implementation, so manual configuration is rarely needed.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

If you have any questions or feedback, please open an issue on GitHub.
