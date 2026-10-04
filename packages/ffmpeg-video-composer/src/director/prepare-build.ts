import type { ProjectBuildInfos, Section, TemplateDescriptor, VideoConfig } from '@/core/types';
import { DEFAULT_TRANSITION_DURATION } from '../schemas/effects.schemas';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type Project from '../core/models/Project';
import { tapFFmpegCommands } from '@/core/determinism/command-tap';
import { resolveDeterministic } from '@/core/determinism/contract';
import { resolveFps, resolveOrientationScale } from './resolve-video-config';
import { resolveMotionDescriptor } from '@/core/motion/tokens';

export { discardOutput, publishOutput, resolveOutputPaths } from './output-staging';
export { qcExpectations } from './qc-expectations';

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
    intercept: project.commandInterceptor,
  });
}

/**
 * The descriptor with every `$token` resolved and travel scaled by `global.motion.energy`
 * (core/motion/tokens.ts).
 */
export function prepareMotion<T extends { meta?: unknown; global?: unknown; sections?: unknown }>(descriptor: T): T {
  return resolveMotionDescriptor(descriptor);
}

type BoundaryTransition = ProjectBuildInfos['transitions'][number];

/** The `transition` a section or the descriptor's `global` declares. */
type DeclaredTransition = Section['transition'];

/**
 * The per-boundary transitions of the N rendering sections (N-1 boundaries, in order). Each boundary
 * takes the transition of the EARLIER section or the global default; it is only a non-cut transition
 * when one is declared. Cut boundaries keep type 'cut' (duration 0 in timeline math).
 */
export function boundaryTransitions(
  segments: readonly Section[],
  globalTransition: DeclaredTransition
): BoundaryTransition[] {
  return segments.slice(0, -1).map((segment) => {
    const declared = segment.transition ?? globalTransition;

    if (!declared || declared.type === 'cut') return { type: 'cut', duration: 0 };

    const duration = declared.duration ?? globalTransition?.duration ?? DEFAULT_TRANSITION_DURATION;

    return { type: declared.type, duration, ease: declared.ease };
  });
}
