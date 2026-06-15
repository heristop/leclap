import 'reflect-metadata';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
// Import the PRE-BUILT output (decorators compiled) — not the raw src — so Metro/Hermes never sees
// the core's tsyringe decorators. reflect-metadata is loaded once at the app entry (app/_layout.tsx).
import { compileReactNative, type NativeEngine } from 'ffmpeg-video-composer/reactnative';
import { renderQuip } from '@leclap/creative-kit/renderQuips';
import { MUSIC_ASSETS, FONT_ASSETS, VIDEO_ASSETS } from '@/src/data/mediaCatalog';
import * as Leclap from '@/modules/leclap-ffmpeg';
import type { CompileInput, CompileOptions, CompileResult, CompileService } from './CompileService';

const toPath = (uri: string): string => uri.replace(/^file:\/\//, '');
const toUri = (p: string): string => (p.startsWith('file://') ? p : `file://${p}`);

// A fresh `-progress` file per command so a poll never reads a previous run's stale tail.
let progressCounter = 0;

// The native leclap-ffmpeg module IS the engine the reused core drives (run = ffmpeg, probe = ffprobe).
const engine: NativeEngine = {
  run: (args) => Leclap.run(args),
  probe: (args) => Leclap.probe(args),
  // M3 live progress: the core injects `-progress <path>` and polls it while the (blocking) native
  // run is in flight; ffmpeg writes the file at a real device path, we read it via expo-file-system.
  progressFilePath: () => `${toPath(FileSystem.cacheDirectory ?? '')}leclap-progress-${(progressCounter += 1)}.txt`,
  readTextFile: (path) => FileSystem.readAsStringAsync(toUri(path)).catch(() => ''),
};

// Stage the template's default bundled music into the assets dir so the core resolves it offline.
// The core looks for `${assetsDir}/musics/<name>.mp3` (MusicComposer.resolveCachedMusic), but a
// template ships `global.music: { name }` with no URL and Metro-bundles the track as an opaque asset
// id — not a plain filesystem path. Without staging, the on-device compile aborts with "Music URL is
// not provided." Tracks not in MUSIC_ASSETS (e.g. a `{ name, url }` entry) are left for the core to
// download from their URL.
async function stageBundledMusic(name: string | undefined, assetsDir: string): Promise<void> {
  if (!name) return;

  const fileName = name.endsWith('.mp3') ? name : `${name}.mp3`;

  if (!(fileName in MUSIC_ASSETS)) return;

  const assetModule = MUSIC_ASSETS[fileName];

  const destination = `${assetsDir}/musics/${fileName}`;

  if ((await FileSystem.getInfoAsync(toUri(destination))).exists) return;

  const asset = await Asset.fromModule(assetModule).downloadAsync();

  await FileSystem.makeDirectoryAsync(toUri(`${assetsDir}/musics`), { intermediates: true }).catch(() => {});
  await FileSystem.copyAsync({ from: toUri(asset.localUri ?? asset.uri), to: toUri(destination) });
}

// Stage the bundled drawtext fonts into `assetsDir/fonts` so the core resolves them locally
// (FilesystemExpoAdapter.resolveBundledFont). Without this, the engine falls back to the Google
// Fonts download, which can't resolve multi-word families (a `BebasNeue.ttf` filename → family
// "BebasNeue", not "Bebas Neue") → the font never lands → drawtext aborts with rc=-22. Idempotent.
async function stageBundledFonts(assetsDir: string): Promise<void> {
  const fontsDir = `${assetsDir}/fonts`;
  await FileSystem.makeDirectoryAsync(toUri(fontsDir), { intermediates: true }).catch(() => {});

  await Promise.all(
    Object.entries(FONT_ASSETS).map(async ([fileName, assetModule]) => {
      const destination = `${fontsDir}/${fileName}`;

      if ((await FileSystem.getInfoAsync(toUri(destination))).exists) return;

      const asset = await Asset.fromModule(assetModule).downloadAsync();
      await FileSystem.copyAsync({ from: toUri(asset.localUri ?? asset.uri), to: toUri(destination) });
    })
  );
}

// Stage the bundled videos a template references by canonical URL (e.g. the brand bumper's
// `options.videoUrl`) under `assetsDir/videos` so the core resolves them locally
// (FilesystemExpoAdapter.resolveLocalAsset) instead of downloading the canonical URL — which on-device
// returns a 404 HTML page, so the engine fails the segment with AVERROR_INVALIDDATA. Staged
// unconditionally (the set is just the brand bumpers): a template's partials are still `ref`s at this point
// — the core expands them internally — so the descriptor's sections don't yet expose the videoUrl.
async function stageBundledVideos(assetsDir: string): Promise<void> {
  const videosDir = `${assetsDir}/videos`;
  await FileSystem.makeDirectoryAsync(toUri(videosDir), { intermediates: true }).catch(() => {});

  await Promise.all(
    Object.entries(VIDEO_ASSETS).map(async ([fileName, assetModule]) => {
      const destination = `${videosDir}/${fileName}`;

      if ((await FileSystem.getInfoAsync(toUri(destination))).exists) return;

      const asset = await Asset.fromModule(assetModule).downloadAsync();
      await FileSystem.copyAsync({ from: toUri(asset.localUri ?? asset.uri), to: toUri(destination) });
    })
  );
}

// Prepare the on-device build/asset dirs and the ProjectConfig the core compiles against.
async function buildProjectConfig(input: CompileInput) {
  const { descriptor, clips } = input;
  const cache = toPath(FileSystem.cacheDirectory ?? '');
  const buildDir = `${cache}leclap-build`;
  const assetsDir = `${cache}leclap-assets`;

  await FileSystem.makeDirectoryAsync(toUri(buildDir), { intermediates: true }).catch(() => {});
  await stageBundledFonts(assetsDir);
  await stageBundledMusic(descriptor.global?.music?.name, assetsDir);
  await stageBundledVideos(assetsDir);

  // Recorded clips, keyed by section name → the plain paths ffmpeg reads.
  const userVideoPaths: Record<string, string> = {};

  for (const [name, clip] of Object.entries(clips)) {
    userVideoPaths[name] = toPath(clip.path);
  }

  return {
    buildDir,
    assetsDir,
    fields: {},
    userVideoPaths,
    music: descriptor.global?.music,
    // On-device H.264, per platform (the LGPL build has no libx264/GPL). Android statically links
    // libopenh264 (Cisco, software) — real H.264 that works off the core's -filter_complex commands
    // (unlike the broken h264_mediacodec on emulator). iOS has no libopenh264; it encodes with Apple's
    // h264_videotoolbox (hardware, in the iOS build) — the core treats videotoolbox as a hardware
    // encoder (bitrate target, no libx264-only flags). Verified encoding on the simulator.
    codecConfig: {
      videoCodec: Platform.OS === 'ios' ? 'h264_videotoolbox' : 'libopenh264',
      audioCodec: 'aac',
    },
    hardwareConfig: { hwaccel: null, preset: 'medium' },
  };
}

export class CoreCompilationService implements CompileService {
  async compile(input: CompileInput, options: CompileOptions = {}): Promise<CompileResult> {
    if (options.signal?.aborted) {
      return { success: false, error: 'Compilation cancelled.' };
    }

    const projectConfig = await buildProjectConfig(input);

    // Cooperative cancellation: ffmpeg exits as on SIGTERM, the failed run rejects inside
    // compileReactNative, and the catch below surfaces it as a failed compile.
    const onAbort = () => {
      Leclap.cancel();
    };

    options.signal?.addEventListener('abort', onAbort);

    try {
      const outputPath = await compileReactNative(
        projectConfig,
        input.descriptor as Parameters<typeof compileReactNative>[1],
        engine,
        (fraction) => options.onProgress?.({ ratio: fraction, stage: renderQuip(fraction) })
      );

      if (!outputPath) {
        return { success: false, error: 'Compilation produced no output.' };
      }

      const info = await FileSystem.getInfoAsync(toUri(outputPath));

      if (!info.exists || info.size === 0) {
        return { success: false, error: 'Compilation produced an empty output file.' };
      }

      options.onProgress?.({ ratio: 1, stage: 'Done' });

      return { success: true, outputUri: toUri(outputPath) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
}
