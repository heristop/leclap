// The engine's HTML layer page (packages/ffmpeg-video-composer/dist/html-rasteriser.html, staged into
// assets/ by scripts/copy-core-assets.ts): one self-contained file, the WebAssembly inlined. Read once and
// kept, so later renders mount the WebView without touching the disk.

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import rasterPage from '@/assets/html-rasteriser/html-rasteriser.html';

let source: Promise<string> | undefined;

async function read(): Promise<string> {
  const asset = await Asset.fromModule(rasterPage).downloadAsync();

  return FileSystem.readAsStringAsync(asset.localUri ?? asset.uri);
}

export function loadRasterPage(): Promise<string> {
  source ??= read().catch((error: unknown) => {
    source = undefined;

    throw error;
  });

  return source;
}
