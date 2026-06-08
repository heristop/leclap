---
name: cross-platform-ffmpeg
description: Use when working with FFmpeg across Node/Static/WASM, the PlatformBridge, the FFmpeg detection/fallback chain, or browser/React Native runtime constraints in ffmpeg-video-composer.
---

# Cross-Platform FFmpeg

## Overview

The core never calls FFmpeg directly — it goes through an `AbstractFFmpeg` adapter chosen by the runtime. `PlatformBridge` detects the environment and wires the right adapter; the Node path additionally auto-detects an FFmpeg binary with a fallback chain. Full detail: `docs/ffmpeg-fallback-strategy.md` and `docs/architecture.md`.

- Bridge: `packages/ffmpeg-video-composer/src/platform/PlatformBridge.ts`
- Adapters: `packages/ffmpeg-video-composer/src/platform/ffmpeg/` (`AbstractFFmpeg`, `FFmpegNodeAdapter`, `FFmpegStaticAdapter`, `FFmpegWasmAdapter`, `FFmpegDetector`, plus `*Music*` adapters)

## Adapter selection by runtime

| Runtime      | FFmpeg                                      | Filesystem                             | Logger           |
| ------------ | ------------------------------------------- | -------------------------------------- | ---------------- |
| Node.js      | `FFmpegNodeAdapter` → `FFmpegStaticAdapter` | `FilesystemNodeAdapter`                | `PinoLogAdapter` |
| Browser      | `FFmpegWasmAdapter` (`@ffmpeg/ffmpeg`)      | `BrowserFilesystemAdapter` (IndexedDB) | console logger   |
| React Native | `FFmpegWasmAdapter`                         | `FilesystemNodeAdapter`                | `PinoLogAdapter` |

## Node detection / fallback chain

`FFmpegDetector` resolves, in order:

1. **System** FFmpeg (`ffmpeg -version` on PATH) → `FFmpegNodeAdapter` (fluent-ffmpeg).
2. **`ffmpeg-static`** bundled binary → `FFmpegStaticAdapter`.
3. **`@ffmpeg/ffmpeg`** WASM → `FFmpegWasmAdapter`.
4. None found → throws with platform-specific install instructions.

Installing system FFmpeg (e.g. via `mise`) is the fastest Node path.

## Entry points

- Node: `packages/ffmpeg-video-composer/src/index.ts` registers Node adapters into the tsyringe `container`.
- Browser/WASM: `packages/ffmpeg-video-composer/src/browser.ts` registers WASM + IndexedDB + browser event manager.

Keep the two bundles separate — anything imported by `browser.ts` must be browser-safe (no Node built-ins).

## Browser / WASM constraints

- ~**2 GB** input limit per WASM instance (IndexedDB-backed filesystem).
- Use `fetch` for remote assets; no Node `fs`.
- Progress and cancellation flow through the browser event manager (`BrowserEventManager`); the WASM adapter wires FFmpeg's progress listener to it.

## Common mistakes

- Calling FFmpeg directly instead of through `AbstractFFmpeg` — breaks one or more platforms.
- Importing a Node module along the `browser.ts` path → bundle/runtime failure in the browser.
- Adding a new FFmpeg capability to one adapter only — add it to `AbstractFFmpeg` and every concrete adapter that should support it.
- Assuming a binary exists — respect the detector's fallback rather than hardcoding a path.
