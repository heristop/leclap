# LeClap - Mobile Video Composer

LeClap is a mobile application built with Expo and React Native for creating video content from customizable templates. It compiles videos **on-device** through an embedded native FFmpeg engine ([`ffmpeg-engine`](../../packages/ffmpeg-engine)), falling back to the [HTTP server](../../packages/server-app) when needed — rendering the same [`@leclap/creative-kit`](../../packages/creative-kit) templates as the web app and CLI.

## Features

- **Template Browser**: Discover and select from various video templates and scenarios
- **Video Recording**: Record video segments for each section of a template using device camera
- **Project Management**: Create, manage, and organize video projects
- **Real-time Preview**: Preview recordings before finalizing sections
- **Video Compilation**: Compile final videos using the backend FFmpeg processing engine
- **Project Status Tracking**: Monitor project status (draft, processing, completed)
- **Media Library Integration**: Save and manage compiled videos in device gallery
- **Cross-platform Support**: Run on iOS, Android, and web platforms

## Technology Stack

- **React Native** 0.81.4
- **Expo** ~54.0.13 with New Architecture enabled
- **Expo Router** ~6.0.11 for navigation
- **TypeScript** ~5.8.3
- **React Native Vision Camera** ^4.7.2 for video recording
- **Expo Video** ~3.0.11 for video playback
- **React Native Reanimated** ~4.1.1 for animations

## Prerequisites

### Backend Server

This app requires the **FFmpeg Video Composer** backend server to be running for video compilation functionality. Ensure you have:

1. **FFmpeg** installed on your system and available in PATH
2. **Node.js** ≥ 24
3. The backend server running on `localhost:8082` (fallback for on-device compiles)

### Mobile Development

- **Expo CLI** or **Expo Dev Tools**
- **Android Studio** (for Android development)
- **Xcode** (for iOS development on macOS)
- Physical device or emulator/simulator

## Installation & Setup

1. **Navigate to the app directory:**

   ```bash
   cd apps/leclap-expo
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Start the Expo development server:**

   ```bash
   pnpm start
   ```

4. **Run on specific platforms:**

   ```bash
   # Android
   pnpm android

   # iOS
   pnpm ios

   # Web
   pnpm web
   ```

## Backend Connection

### Starting the Backend Server

Before using the mobile app, start the FFmpeg Video Composer server from the project root:

```bash
pnpm server:dev
```

### Android Port Forwarding

If running the app on an Android device or emulator with the backend on `localhost:8082`, enable port forwarding:

```bash
adb reverse tcp:8082 tcp:8082
```

Run this command **after** starting the backend server and **before** launching the mobile app. This step is not required for iOS simulators.

### Configuration

The app is configured to connect to `http://localhost:8082` by default (defined in `app.json`). Update the `extra.API_URL` field if your backend runs on a different address.

## Usage

1. **Launch the app** using Expo Go or a development build
2. **Browse Templates**: Navigate to explore available video templates
3. **Start Project**: Select a template to create a new video project
4. **Record Sections**: Use the camera interface to record video for each template section
5. **Review & Edit**: Preview recorded sections and re-record if needed
6. **Compile Video**: Submit your project for backend processing
7. **View Results**: Access completed videos in the "My Videos" section

## Development

### Available Scripts

```bash
# Start development server
pnpm start

# Run on platforms
pnpm android
pnpm ios
pnpm web

# Code quality
pnpm lint
pnpm test
```

### Project Structure

```text
app/
├── (app)/                 # Main app screens with bottom tabs
├── (fullscreen)/          # Fullscreen modal screens
├── components/            # Reusable UI components
├── features/              # Feature-specific modules
│   ├── editor/           # Video editing and recording
│   ├── projects/         # Project management
│   └── templates/        # Template browser
├── hooks/                # Custom React hooks
├── services/             # API and external services
├── styles/               # Theme and styling
└── utils/                # Utility functions
```

### Architecture

The app uses **Expo Router** for file-based routing with:

- **Bottom tab navigation** for main screens
- **Stack navigation** within feature areas
- **Modal presentations** for fullscreen experiences
- **TypeScript** for type safety throughout

## Permissions

The app requires the following permissions:

### iOS

- **Camera**: Record videos for project sections
- **Microphone**: Capture audio with video recordings
- **Photo Library**: Save and import video content

### Android

- **Camera**: `android.permission.CAMERA`
- **Audio Recording**: `android.permission.RECORD_AUDIO`
- **Storage Access**: `android.permission.READ_EXTERNAL_STORAGE`, `android.permission.WRITE_EXTERNAL_STORAGE`

## Migration from leclap-playground

This app replaces the deprecated `leclap-playground` with:

- Updated Expo SDK and dependencies
- React Native architecture
- TypeScript support
- Camera and video capabilities
- Expo Router navigation

## Troubleshooting

### Common Issues

**Backend Connection Fails**

- Ensure the backend server is running on `localhost:8082`
- For Android, verify `adb reverse tcp:8082 tcp:8082` was executed
- Check that FFmpeg is properly installed and accessible

**Camera Permissions Denied**

- Grant camera and microphone permissions in device settings
- Restart the app after permission changes

**App Won't Start**

- Clear Expo cache: `npx expo start --clear`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`

## License

This project is part of the [LeClap monorepo](../../README.md) and follows the same MIT License. For the on-device compile pipeline, see [On-Device Compilation](../../docs/on-device-compilation.md).
