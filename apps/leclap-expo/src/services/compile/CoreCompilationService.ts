import 'reflect-metadata';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
// Import the PRE-BUILT output (decorators compiled) — not the raw src — so Metro/Hermes never sees
// the core's tsyringe decorators. reflect-metadata is loaded once at the app entry (app/_layout.tsx).
import { compileReactNative, type NativeEngine } from 'ffmpeg-video-composer/reactnative';
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

// Prepare the on-device build/asset dirs and the ProjectConfig the core compiles against.
async function buildProjectConfig(input: CompileInput) {
  const { descriptor, clips } = input;
  const cache = toPath(FileSystem.cacheDirectory ?? '');
  const buildDir = `${cache}leclap-build`;
  const assetsDir = `${cache}leclap-assets`;

  await FileSystem.makeDirectoryAsync(toUri(buildDir), { intermediates: true }).catch(() => {});
  await FileSystem.makeDirectoryAsync(toUri(`${assetsDir}/fonts`), { intermediates: true }).catch(() => {});

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
        (fraction) => options.onProgress?.({ ratio: fraction, stage: 'Rendering' })
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
