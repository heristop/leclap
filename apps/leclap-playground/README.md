# LeClap - Video Composer Playground

## Features

- Browse video templates/scenarios
- Record videos for each section of a template
- Manage recorded projects
- Compile videos using the associated backend server
- Display project status (draft, processing, completed)
- Delete individual projects and all projects

## Technology Stack

- React Native
- Expo
- Expo Router

## Setup

1.  **Install dependencies using pnpm:**

```bash
pnpm install
```

2.  **Start the Expo app:**

```bash
npx expo start
```

Follow the instructions in the terminal to open the app on an emulator, simulator, or physical device using the Expo Go app.

3.  **Connecting to Local Backend (Android):**

If you are running the app on an Android device or emulator and your backend server (`ffmpeg-video-composer`) is running on `localhost:3000`, you need to forward the port using ADB:

```bash
adb reverse tcp:3000 tcp:3000
```

Run this command in your terminal _after_ starting the backend server and _before_ launching the app on Android. This allows the app to reach your local server. (This step is not needed for iOS simulators).

## Backend Setup

This app requires the `ffmpeg-video-composer` backend server to be running for video compilation.

**Ensure the backend server is running** before attempting to compile videos in the mobile app. The mobile app is configured to connect to `http://localhost:3000` by default (defined in `app.json` extra field), but this may need to be updated based on where your backend is running.

## Usage

1.  Open the app in Expo Go or a development build.
2.  Navigate to the "Scenarios" tab to browse available video templates.
3.  Select a template to start a new project.
4.  Record videos for each section of the template.
5.  Once all sections are recorded, compile the video.
6.  View your compiled videos in the "My Videos" tab.
