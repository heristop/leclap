import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { EffectSection } from 'ffmpeg-video-composer';
import { z } from 'zod';
import type { McpConfig } from '../config.js';
import { validateTemplate } from '../compose/validation.js';
import { assertWithinMediaDir } from '../compose/pathGuard.js';
import { assertDescriptorSafe } from '../compose/descriptorGuard.js';
import { probeMedia } from '../tools/probeMedia.js';

export const TITLE_EFFECT_ID = 'leclap.title-reveal';
export const TITLE_EFFECT_VERSION = '1.0.0';
export const TITLE_COMPOSITION_ID = 'LeclapTitle';
export const titlePropsSchema = z
  .object({
    headline: z.string().trim().min(1).max(80).default('LECLAP'),
    headlineY: z.number().min(0).max(720).default(320),
    logoDelayFrames: z.number().int().min(0).max(299).default(15),
    entranceDurationFrames: z.number().int().min(1).max(300).default(24),
    springDamping: z.number().min(1).max(100).default(18),
  })
  .strict()
  .refine((props) => props.logoDelayFrames + props.entranceDurationFrames <= 300, {
    message: 'Logo entrance must finish within the 300-frame scene.',
  });
export const titleAssetsSchema = z
  .object({ background: z.string().min(1), logo: z.string().min(1), font: z.string().min(1) })
  .strict();
export type TitleProps = z.infer<typeof titlePropsSchema>;
export interface PreparedTitle {
  section: EffectSection;
  props: TitleProps;
  assets: z.infer<typeof titleAssetsSchema>;
}
export type EffectConfig = Pick<McpConfig, 'mediaDir'> &
  Partial<Pick<McpConfig, 'allowRemotion' | 'remotionEntry' | 'browserExecutable'>>;

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

const EXTENSIONS = {
  background: new Set(['.mp4', '.mov', '.webm', '.m4v']),
  logo: new Set(['.png', '.jpg', '.jpeg', '.webp']),
  font: new Set(['.ttf', '.otf', '.woff', '.woff2']),
};

async function prepareAsset(key: keyof PreparedTitle['assets'], candidate: string, mediaDir: string): Promise<string> {
  const real = await assertWithinMediaDir(path.resolve(mediaDir, candidate), mediaDir);

  if (!EXTENSIONS[key].has(path.extname(real).toLowerCase())) {
    throw new Error(`effect_asset_invalid: unsupported ${key} extension.`);
  }

  if (!(await fs.stat(real)).isFile()) throw new Error(`effect_asset_invalid: ${key} must be a regular file.`);

  return real;
}

async function prepareSection(section: EffectSection, config: EffectConfig): Promise<PreparedTitle> {
  if (section.effect.id !== TITLE_EFFECT_ID || section.effect.version !== TITLE_EFFECT_VERSION) {
    throw new Error(
      `effect_not_registered: ${section.effect.id}@${section.effect.version}; supported ${TITLE_EFFECT_ID}@${TITLE_EFFECT_VERSION}.`
    );
  }

  if (section.options.duration !== 10) {
    throw new Error('effect_duration_mismatch: LeclapTitle requires exactly 10 seconds.');
  }

  if (JSON.stringify({ props: section.effect.props, assets: section.effect.assets }).includes('{{')) {
    throw new Error('effect_placeholder_unresolved: props and assets must contain concrete values.');
  }
  const props = titlePropsSchema.parse(section.effect.props);
  const raw = titleAssetsSchema.parse(section.effect.assets);
  const [background, logo, font] = await Promise.all([
    prepareAsset('background', raw.background, config.mediaDir),
    prepareAsset('logo', raw.logo, config.mediaDir),
    prepareAsset('font', raw.font, config.mediaDir),
  ]);
  const stat = await fs.stat(background);
  const probe = await probeMedia(background, stat.size);

  if (!probe.videoCodec || probe.durationSeconds === null || probe.durationSeconds < 10) {
    throw new Error('effect_asset_invalid: background must contain at least 10 seconds of video.');
  }

  return { section, props, assets: { background, logo, font } };
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
    throw new Error('effect_output_incompatible: LeclapTitle requires landscape 1280x720 at 30 fps.');
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
