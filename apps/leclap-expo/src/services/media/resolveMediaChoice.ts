import { Asset } from 'expo-asset';
import { musicAsset, backgroundAsset, findMusic, findBackground } from '@/src/data/mediaCatalog';
import type { MediaChoice, ResolvedMediaFile } from '@/src/types';
export { needsMediaStep } from './mediaStepHelpers';

/**
 * Resolves a music MediaChoice to a local file URI + metadata.
 *
 * - library pick  → downloads the bundled Metro asset and returns its localUri
 * - upload pick   → returns the user's picked file URI as-is
 *
 * Returns undefined when the choice cannot be resolved (unknown library id).
 */
export async function resolveMusicChoice(choice: MediaChoice): Promise<ResolvedMediaFile | undefined> {
  if (choice.kind === 'upload') {
    return { uri: choice.uri, name: choice.name, mimeType: 'audio/mpeg' };
  }

  const assetModule = musicAsset(choice.id);

  if (assetModule === undefined) return undefined;

  const asset = await Asset.fromModule(assetModule).downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const entry = findMusic(choice.id);
  const name = entry?.file ?? `${choice.id}.mp3`;

  return { uri, name, mimeType: 'audio/mpeg' };
}

/**
 * Resolves a background MediaChoice to a local file URI + metadata.
 *
 * - library pick  → downloads the bundled Metro asset and returns its localUri
 * - upload pick   → returns the user's picked file URI as-is
 *
 * Returns undefined when the choice cannot be resolved (unknown library id).
 */
export async function resolveBackgroundChoice(choice: MediaChoice): Promise<ResolvedMediaFile | undefined> {
  if (choice.kind === 'upload') {
    return { uri: choice.uri, name: choice.name, mimeType: 'image/jpeg' };
  }

  const assetModule = backgroundAsset(choice.id);

  if (assetModule === undefined) return undefined;

  const asset = await Asset.fromModule(assetModule).downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const entry = findBackground(choice.id);
  const name = entry?.file ?? `${choice.id}.jpg`;

  return { uri, name, mimeType: 'image/jpeg' };
}
