import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { EffectSection } from 'ffmpeg-video-composer';
import type { McpConfig } from '../config.js';
import { validateTemplate } from '../compose/validation.js';
import { assertWithinMediaDir } from '../compose/pathGuard.js';
import { assertDescriptorSafe } from '../compose/descriptorGuard.js';
import { probeMedia } from '../tools/probeMedia.js';

export * from './title-definition.js';
import { getEffectDefinition } from './effect-catalog.js';
export interface PreparedTitle {
  section: EffectSection;
  props: Record<string, unknown>;
  assets: Record<string, string>;
  /** Always present after preflight; optional only for legacy builtin callers. */
  compositionId?: string;
  definitionHash?: string;
}
export type EffectConfig = Pick<McpConfig, 'mediaDir'> &
  Partial<Pick<McpConfig, 'allowRemotion' | 'remotionEntry' | 'browserExecutable' | 'effectCatalog'>>;

export async function assertEffectBackend(config: EffectConfig): Promise<void> {
  if (!config.allowRemotion) {
    throw new Error('effect_backend_unavailable: enable --allow-remotion for trusted local Remotion effects.');
  }

  if (!config.remotionEntry) {
    throw new Error(
      'effect_backend_unavailable: configure --remotion-entry / LECLAP_MCP_REMOTION_ENTRY with the trusted LeclapTitle root.'
    );
  }

  if (!(await fs.stat(config.remotionEntry)).isFile()) {
    throw new Error('effect_backend_unavailable: Remotion entry must be a regular file.');
  }
  const require = createRequire(import.meta.url);

  try {
    require.resolve('@remotion/bundler');
    require.resolve('@remotion/renderer');
  } catch {
    throw new Error('effect_backend_unavailable: install @remotion/bundler and @remotion/renderer (v4).');
  }
}

async function prepareAsset(
  key: string,
  candidate: string,
  mediaDir: string,
  extensions: readonly string[]
): Promise<string> {
  const real = await assertWithinMediaDir(path.resolve(mediaDir, candidate), mediaDir);

  if (!extensions.includes(path.extname(real).toLowerCase())) {
    throw new Error(`effect_asset_invalid: unsupported ${key} extension.`);
  }

  if (!(await fs.stat(real)).isFile()) throw new Error(`effect_asset_invalid: ${key} must be a regular file.`);

  return real;
}

async function prepareSection(section: EffectSection, config: EffectConfig): Promise<PreparedTitle> {
  const definition = getEffectDefinition(section.effect.id, section.effect.version, config.effectCatalog);

  if (section.options.duration !== definition.output.durationSeconds) {
    throw new Error(`effect_duration_mismatch: ${definition.compositionId} requires exactly 10 seconds.`);
  }

  if (JSON.stringify({ props: section.effect.props, assets: section.effect.assets }).includes('{{')) {
    throw new Error('effect_placeholder_unresolved: props and assets must contain concrete values.');
  }
  const props = definition.props.parse(section.effect.props);
  const raw = definition.assets.parse(section.effect.assets);
  const assets = Object.fromEntries(
    await Promise.all(
      Object.entries(raw).map(async ([key, candidate]) => [
        key,
        await prepareAsset(key, candidate, config.mediaDir, definition.assetExtensions[key]),
      ])
    )
  ) as PreparedTitle['assets'];

  await Promise.all(
    Object.entries(definition.assetVideoPolicies).map(async ([key, policy]) => {
      if (!Object.hasOwn(assets, key)) return;
      const stat = await fs.stat(assets[key]);
      const probe = await probeMedia(assets[key], stat.size);

      if (
        !probe.videoCodec ||
        probe.durationSeconds === null ||
        probe.durationSeconds < policy.minVideoDurationSeconds
      ) {
        throw new Error(
          `effect_asset_invalid: ${key} must contain at least ${policy.minVideoDurationSeconds} seconds of video.`
        );
      }
    })
  );

  return { section, props, assets, compositionId: definition.compositionId, definitionHash: definition.definitionHash };
}

/** Registry/schema/backend/asset preflight only: never bundles or renders source. */
export async function validateEffects(
  template: Record<string, unknown>,
  config: EffectConfig
): Promise<Map<string, PreparedTitle>> {
  const parsed = validateTemplate(template);

  if (!parsed.ok) throw new Error(parsed.message);
  const sections = (parsed.descriptor.sections ?? []).filter(
    (section): section is EffectSection => section.type === 'effect'
  );

  if (sections.length === 0) return new Map();
  await assertEffectBackend(config);
  const global = parsed.descriptor.global;

  if (!isCompatibleOutput(global)) {
    throw new Error('effect_output_incompatible: Registered effects require landscape 1280x720 at 30 fps.');
  }
  const names = new Set<string>();

  for (const section of sections) {
    if (names.has(section.name)) throw new Error(`duplicate_effect_name: ${section.name}`);
    names.add(section.name);
  }
  const safety = await assertDescriptorSafe(parsed.descriptor, config.mediaDir);

  if (!safety.ok) throw new Error(safety.message);
  const prepared = await Promise.all(sections.map((section) => prepareSection(section, config)));

  return new Map(prepared.map((title) => [title.section.name, title]));
}

function isCompatibleOutput(global: { fps?: number; orientation?: string } | undefined) {
  return (global?.fps ?? 30) === 30 && (global?.orientation ?? 'landscape') === 'landscape';
}
