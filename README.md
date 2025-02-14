# FFmpeg Video Composer

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.x-brightgreen.svg)](https://nodejs.org/en/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`ffmpeg-video-composer` is a tool designed to streamline the process of video compilation and audio mixing using FFmpeg. It enables dynamic template generation, video rendering, and audio composition, making it a comprehensive solution for creating personalized multimedia content programmatically.

## 🎥 Demo

Check out the video sample to see `ffmpeg-video-composer` in action (unmute for sound):

https://github.com/heristop/assets/6bcd0578-7dee-4630-aa6b-c730cf5cec17

[View the template descriptor](https://github.com/heristop/ffmpeg-video-composer/blob/main/src/shared/templates/sample.json)

## 🚀 Features

* Dynamic video and audio template generation
* Easy video compilation and audio mixing using FFmpeg
* Flexible JSON-based template descriptor system
* CLI for quick video creation
* JSON configuration for complex project setups
* Custom project configurations support
* Audio overlay and mixing capabilities
* Automated video editing and composition

## 🛠 Installation

### Using npm (or yarn/pnpm)

```bash
pnpm add ffmpeg-video-composer
```

### Cloning the Repository

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
  assetsDir: './assets',
  currentLocale: 'en',
  fields: {
    form_1_firstname: 'Firstname',
    form_1_lastname: 'Lastname',
  },
};

// Using a template descriptor object
compile(projectConfig, {
  global: {
    // ... (template configuration)
  },
  sections: [
    // ... (section configurations)
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

graph TB
    %% Style Definitions
    classDef core fill:#EDF7FF,stroke:#4B83B8,stroke-width:2px
    classDef abstract fill:#F9F3FF,stroke:#9D7AB8,stroke-width:2px,stroke-dasharray: 5 5
    classDef implementation fill:#E8F3EC,stroke:#67B58A,stroke-width:2px
    classDef entry fill:#FFF4E6,stroke:#E8A364,stroke-width:2px
    classDef builder fill:#FFE8E8,stroke:#E88B8B,stroke-width:2px
    classDef title fill:none,stroke:none

    %% Entry Points and Director Pattern
    subgraph Flow ["🚀 Application Flow"]
        direction LR
        main[("main.ts")]:::entry -->
        index["index.ts"]:::entry

        subgraph DirectorPattern ["👷 Builder Pattern Implementation"]
            direction TB
            director["TemplateDirector.ts"]:::builder
            template_builder["TemplateConcreteBuilder.ts"]:::builder
            director --> template_builder
        end

        index --> director
    end

    %% Core Domain
    subgraph Core ["💎 Core Domain"]
        direction TB
        subgraph Models ["Domain Models"]
            direction TB
            models_title["Core Business Objects"]:::title
            core_project["Project.ts"]:::core
            core_segment["Segment.ts"]:::core
            core_template["Template.ts"]:::core
        end

        subgraph Utils ["Core Utilities"]
            direction TB
            utils_title["Support Types & Config"]:::title
            core_types["types.ts"]:::core
            core_config["default.config.ts"]:::core
            core_format["FormatHelper.ts"]:::core
        end
    end

    %% Platform Layer
    subgraph Platform ["⚡ Platform Layer"]
        direction TB
        subgraph Abstractions ["Interface Definitions"]
            direction TB
            abstractions_title["Abstract Interfaces"]:::title
            abstract_ffmpeg["AbstractFFmpeg.ts"]:::abstract
            abstract_music["AbstractMusic.ts"]:::abstract
            abstract_fs["AbstractFilesystem.ts"]:::abstract
            abstract_logger["AbstractLogger.ts"]:::abstract
        end

        subgraph Adapters ["Concrete Implementations"]
            direction TB
            adapters_title["Platform Adapters"]:::title
            ffmpeg_node["FFmpegNodeAdapter.ts"]:::implementation
            music_node["MusicNodeAdapter.ts"]:::implementation
            fs_node["FilesystemNodeAdapter.ts"]:::implementation
            pino_adapter["PinoLogAdapter.ts"]:::implementation
        end

        platform_bridge["PlatformBridge.ts"]:::implementation
        event_manager["EventManager.ts"]:::implementation
    end

    %% Editor Components
    subgraph Editor ["🎥 Video Processing"]
        direction TB
        subgraph EditorCore ["Core Editor Components"]
            editor_title["Main Processing Units"]:::title
            video_editor["VideoEditor.ts"]:::implementation
            music_composer["MusicComposer.ts"]:::implementation
            segment_builder["SegmentBuilder.ts"]:::implementation
        end

        subgraph VideoSegments ["Video Segment Types"]
            segments_title["Segment Implementations"]:::title
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
        resources_title["Resource Managers"]:::title
        asset_manager["AssetManager.ts"]:::implementation
        filter_manager["FilterManager.ts"]:::implementation
        formatter_manager["FormatterManager.ts"]:::implementation
        map_manager["MapManager.ts"]:::implementation
        var_manager["VariableManager.ts"]:::implementation
    end

    %% Key Relationships
    director --> |"orchestrates"| event_manager
    director --> |"uses"| video_editor
    template_builder --> |"creates"| segment_builder
    template_builder --> |"uses"| segment_factory

    segment_factory --> |"creates"| video_segment & color_bg_segment & image_bg_segment & project_video_segment
    video_segment & color_bg_segment & image_bg_segment & project_video_segment --> |"builds via"| segment_builder

    video_editor --> |"uses"| music_composer

    %% Platform Implementation Relations
    platform_bridge --> |"implements"| ffmpeg_node & music_node & fs_node & pino_adapter

    ffmpeg_node --> |"implements"| abstract_ffmpeg
    music_node --> |"implements"| abstract_music
    fs_node --> |"implements"| abstract_fs
    pino_adapter --> |"implements"| abstract_logger

    %% Resource Management Relations
    segment_builder --> |"manages"| asset_manager & filter_manager & formatter_manager & map_manager & var_manager

    %% Core Relations
    core_project --> |"uses"| core_config
    core_project --> |"uses"| core_types

    %% Link Styling
    linkStyle default stroke:#7C8D9D,stroke-width:1px
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

If you have any questions or feedback, please open an issue on GitHub.
