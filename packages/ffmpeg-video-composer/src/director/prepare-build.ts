import type { TemplateDescriptor, VideoConfig } from '@/core/types';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type Project from '../core/models/Project';
import { tapFFmpegCommands } from '@/core/determinism/command-tap';
import { resolveDeterministic } from '@/core/determinism/contract';
import { resolveFps, resolveOrientationScale } from './resolve-video-config';
import { resolveMotionDescriptor } from '@/core/motion/tokens';
import { effectiveOrientation } from '@/core/platforms';
import { resolveThemeDescriptor } from '@/core/theme/resolve';

// Per-build preparation the director runs once per compile, kept out of TemplateDirector for its line
// and dependency budgets.

/**
 * The build's video config: orientation swap/square preset (the authored orientation, else the
 * `global.platform` default), then the descriptor's fps.
 */
export function resolveBuildVideoConfig(
  videoConfig: VideoConfig | undefined,
  descriptor: TemplateDescriptor
): VideoConfig | undefined {
  return resolveFps(
    resolveOrientationScale(videoConfig, effectiveOrientation(descriptor.global)),
    descriptor.global?.fps
  );
}

/**
 * Routes every FFmpeg command of the build through the determinism tap: the deterministic encoder
 * profile unless the host opts out (core/determinism/contract.ts), and a record on
 * `project.ffmpegCommands` for the render manifest. Returns the restore function.
 */
export function recordBuildCommands(adapter: AbstractFFmpeg, project: Project): () => void {
  return tapFFmpegCommands(adapter, {
    deterministic: resolveDeterministic(project.config.deterministic),
    onCommand: (command) => project.ffmpegCommands.push(command),
  });
}

/**
 * The descriptor with every theme token (`$color.*`, `$font.*`) resolved and the theme's motion feel merged
 * into `global.motion` (core/theme), then every motion `$token` resolved and travel scaled by
 * `global.motion.energy` (core/motion/tokens.ts).
 */
export function prepareMotion<T extends { meta?: unknown; global?: unknown; sections?: unknown }>(descriptor: T): T {
  return resolveMotionDescriptor(resolveThemeDescriptor(descriptor));
}
