# FFmpeg Video Composer

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.x-brightgreen.svg)](https://nodejs.org/en/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`ffmpeg-video-composer` is a tool designed to streamline the process of video compilation and audio mixing using FFmpeg. It enables dynamic template generation, video rendering, and audio composition, making it a comprehensive solution for creating personalized multimedia content programmatically.

## 🎥 Demo

Check out the video sample to see `ffmpeg-video-composer` in action (unmute for sound):

https://github.com/heristop/assets/6bcd0578-7dee-4630-aa6b-c730cf5cec17

[View the template descriptor](https://github.com/heristop/ffmpeg-video-composer/blob/main/src/shared/templates/sample.json)

## 🚀 Features

- Dynamic video and audio template generation
- Easy video compilation and audio mixing using FFmpeg
- Flexible JSON-based template descriptor system
- CLI for quick video creation
- JSON configuration for complex project setups
- Custom project configurations support
- Audio overlay and mixing capabilities
- Automated video editing and composition

## ⚠️ Prerequisites

This tool requires **FFmpeg** to be installed on your system and available in your PATH. FFmpeg is used directly for all video and audio processing operations.

### FFmpeg Installation Guide

#### macOS

Using [Homebrew](https://brew.sh/):

```bash
brew install ffmpeg
```

#### Linux

For Debian/Ubuntu:

```bash
sudo apt update && sudo apt install ffmpeg
```

For Fedora:

```bash
sudo dnf install ffmpeg
```

For Arch Linux:

```bash
sudo pacman -S ffmpeg
```

#### Verify Installation

After installation, verify that FFmpeg is properly installed:

```bash
ffmpeg -version
ffprobe -version
```

## 📦 Installation

### Using npm (or yarn/pnpm)

```bash
pnpm add ffmpeg-video-composer
```

### Development Setup

```bash
git clone https://github.com/heristop/ffmpeg-video-composer.git
cd ffmpeg-video-composer
pnpm i
```

## 📖 Usage

### Command Line Interface

```bash
pnpm compile src/shared/templates/sample.json
```

This generates `sample_output.mp4` in the `build` directory.

### Programmatic Usage

```javascript
import { compile, loadConfig } from 'ffmpeg-video-composer';

const projectConfig = {
  buildDir, // Build directory for output files
  assetsDir, // Assets directory for video segments
  // Other project configurations...
  currentLocale: 'en',
  fields: {
    form_1_firstname: 'Firstname',
    form_1_lastname: 'Lastname',
  },
};

// Using a template descriptor object
compile(projectConfig, {
  global: {
    // ... (template global configuration)
  },
  sections: [
    // ... (template sections configurations)
  ],
});

// Or using a JSON file
await compile(projectConfig, await loadConfig('./src/shared/templates/sample.json'));
```

## 🧪 Running Tests

Ensure the quality of the codebase by running the test suite:

```bash
pnpm test
```

## 🏗 Architecture

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'system-ui',
    'fontSize': '13px',
    'primaryColor': '#fff',
    'primaryTextColor': '#2A3F4D',
    'primaryBorderColor': '#7C8D9D',
    'lineColor': '#7C8D9D',
    'tertiaryColor': '#fff'
  }
}}%%

graph TD
    %% Style Definitions
    classDef core fill:#EDF7FF,stroke:#4B83B8,stroke-width:2px
    classDef abstract fill:#F9F3FF,stroke:#9D7AB8,stroke-width:2px,stroke-dasharray: 5 5
    classDef implementation fill:#E8F3EC,stroke:#67B58A,stroke-width:2px
    classDef entry fill:#FFF4E6,stroke:#E8A364,stroke-width:2px
    classDef builder fill:#FFE8E8,stroke:#E88B8B,stroke-width:2px
    classDef title fill:none,stroke:none

    %% Entry Points
    subgraph Flow ["🚀 Application Entry"]
        direction TB
        main[("main.ts")]:::entry --> index["index.ts"]:::entry
    end

    %% Core Domain
    subgraph Core ["💎 Domain Layer"]
        direction TB
        subgraph CoreModels ["Domain Models"]
            core_project["Project.ts"]:::core
            core_segment["Segment.ts"]:::core
            core_template["Template.ts"]:::core
        end

        subgraph CoreUtils ["Core Utilities"]
            core_types["types.ts"]:::core
            core_config["default.config.ts"]:::core
        end
    end

    %% Director Pattern
    subgraph Builder ["👷 Builder Pattern"]
        direction TB
        director["TemplateDirector.ts"]:::builder
        template_builder["TemplateConcreteBuilder.ts"]:::builder
    end

    %% Platform Layer
    subgraph Platform ["⚡ Platform Layer"]
        direction TB
        subgraph PlatformCore ["Core Platform"]
            platform_bridge["PlatformBridge.ts"]:::implementation
            event_manager["EventManager.ts"]:::implementation
        end

        subgraph Abstractions ["Interfaces"]
            abstract_ffmpeg["AbstractFFmpeg.ts"]:::abstract
            abstract_music["AbstractMusic.ts"]:::abstract
            abstract_fs["AbstractFilesystem.ts"]:::abstract
            abstract_logger["AbstractLogger.ts"]:::abstract
        end

        subgraph Adapters ["Platform Adapters"]
            ffmpeg_node["FFmpegNodeAdapter.ts"]:::implementation
            music_node["MusicNodeAdapter.ts"]:::implementation
            fs_node["FilesystemNodeAdapter.ts"]:::implementation
            pino_adapter["PinoLogAdapter.ts"]:::implementation
        end
    end

    %% Editor Components
    subgraph Editor ["🎥 Video Processing"]
        direction TB
        subgraph EditorCore ["Core Processing"]
            video_editor["VideoEditor.ts"]:::implementation
            music_composer["MusicComposer.ts"]:::implementation
            segment_builder["SegmentBuilder.ts"]:::implementation
        end

        subgraph Segments ["Video Segments"]
            segment_factory["SegmentFactory.ts"]:::implementation
            video_segment["VideoSegment.ts"]:::implementation
            color_bg_segment["ColorBackgroundSegment.ts"]:::implementation
            image_bg_segment["ImageBackgroundSegment.ts"]:::implementation
            project_video_segment["ProjectVideoSegment.ts"]:::implementation
        end
    end

    %% Resource Management
    subgraph Resources ["📊 Resource Management"]
        direction TB
        asset_manager["AssetManager.ts"]:::implementation
        filter_manager["FilterManager.ts"]:::implementation
        formatter_manager["FormatterManager.ts"]:::implementation
        map_manager["MapManager.ts"]:::implementation
        var_manager["VariableManager.ts"]:::implementation
    end

    %% Main Flow
    index --> director
    director --> template_builder
    director --> video_editor
    director --> event_manager

    %% Builder Pattern Flow
    template_builder --> segment_builder
    template_builder --> segment_factory

    %% Segment Creation Flow
    segment_factory --> video_segment & color_bg_segment & image_bg_segment & project_video_segment
    video_segment & color_bg_segment & image_bg_segment & project_video_segment --> segment_builder

    %% Platform Relations
    platform_bridge --> ffmpeg_node & music_node & fs_node & pino_adapter
    ffmpeg_node --> abstract_ffmpeg
    music_node --> abstract_music
    fs_node --> abstract_fs
    pino_adapter --> abstract_logger

    %% Resource Management
    segment_builder --> asset_manager & filter_manager & formatter_manager & map_manager & var_manager

    %% Core Dependencies
    core_project --> core_config & core_types

    %% Editor Flow
    video_editor --> music_composer

    %% Link Styling
    linkStyle default stroke:#7C8D9D,stroke-width:1px
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

If you have any questions or feedback, please open an issue on GitHub.
