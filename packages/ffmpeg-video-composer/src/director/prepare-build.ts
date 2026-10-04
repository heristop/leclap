import type { ProjectConfig, TemplateDescriptor, VideoConfig } from '@/core/types';
import { resolveTimeRefs, type TimingOptions } from '@/core/timing/resolve';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type Project from '../core/models/Project';
import { tapFFmpegCommands } from '@/core/determinism/command-tap';
import { resolveDeterministic } from '@/core/determinism/contract';
import { resolveFps, resolveOrientationScale } from './resolve-video-config';
import { resolveMotionDescriptor } from '@/core/motion/tokens';

// Per-build preparation the director runs once per compile, kept out of TemplateDirector for its line
// and dependency budgets.

/** The build's video config: orientation swap/square preset, then the descriptor's fps. */
export function resolveBuildVideoConfig(
  videoConfig: VideoConfig | undefined,
  descriptor: TemplateDescriptor
): VideoConfig | undefined {
  return resolveFps(resolveOrientationScale(videoConfig, descriptor.global?.orientation), descriptor.global?.fps);
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

/** What the time-reference pass needs from the build: output frame, fps, locale and form fields. */
export function timingOptions(config: ProjectConfig): TimingOptions {
  return {
    scale: config.videoConfig?.scale,
    fps: config.videoConfig?.fps,
    locale: config.currentLocale,
    fields: config.fields,
  };
}

/**
 * The descriptor with every `$token` resolved, travel scaled by `global.motion.energy`
 * (core/motion/tokens.ts), then every time reference ("title.end + 0.2", "beat:12"...) resolved to
 * seconds (core/timing/resolve.ts). Lowering only ever sees numbers; a reference that cannot be resolved
 * fails the build here, naming the field, rather than rendering a wrong frame.
 */
export function prepareMotion<T extends { meta?: unknown; global?: unknown; sections?: unknown }>(
  descriptor: T,
  timing: TimingOptions = {}
): T {
  const { descriptor: resolved, issues } = resolveTimeRefs(resolveMotionDescriptor(descriptor), timing);

  if (issues.length > 0) {
    throw new Error(`Time references: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
  }

  return resolved;
}
