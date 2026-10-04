import type { ProjectBuildInfos, ProjectConfig, Section, TemplateDescriptor, VideoConfig } from '@/core/types';
import { DEFAULT_TRANSITION_DURATION } from '../schemas/effects.schemas';
import { resolveTimeRefs, type TimingOptions } from '@/core/timing/resolve';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type Project from '../core/models/Project';
import { tapFFmpegCommands } from '@/core/determinism/command-tap';
import { resolveDeterministic } from '@/core/determinism/contract';
import { resolveFps, resolveOrientationScale } from './resolve-video-config';
import { resolveMotionDescriptor } from '@/core/motion/tokens';
import { effectiveOrientation } from '@/core/platforms';
import { resolveThemeDescriptor } from '@/core/theme/resolve';
import { resolveBuildFormat } from '@/core/formats/resolve';
import { assertEffectsResolved } from '@/core/partials';

export { discardOutput, publishOutput, resolveOutputPaths } from './output-staging';
export { qcExpectations } from './qc-expectations';

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
    intercept: project.commandInterceptor,
  });
}

/**
 * The partial-expanded descriptor as it renders in the requested format (core/formats: `formats[format]`
 * and `$format` values), the FIRST pass before orientation, theme, tokens and time references; then
 * the registered-effects check.
 */
export function prepareFormat(expanded: unknown, format: string | undefined): ReturnType<typeof assertEffectsResolved> {
  return assertEffectsResolved(resolveBuildFormat(expanded, format));
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
 * The descriptor with every theme token (`$color.*`, `$font.*`) resolved and the theme's motion feel merged
 * into `global.motion` (core/theme), every motion `$token` resolved, travel scaled by `global.motion.energy`
 * (core/motion/tokens.ts), then every time reference ("title.end + 0.2", "beat:12"...) resolved to
 * seconds (core/timing/resolve.ts). Lowering only ever sees numbers; a reference that cannot be resolved
 * fails the build here, naming the field, rather than rendering a wrong frame.
 */
export function prepareMotion<T extends { meta?: unknown; global?: unknown; sections?: unknown }>(
  descriptor: T,
  timing: TimingOptions = {}
): T {
  const { descriptor: resolved, issues } = resolveTimeRefs(
    resolveMotionDescriptor(resolveThemeDescriptor(descriptor)),
    timing
  );

  if (issues.length > 0) {
    throw new Error(`Time references: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
  }

  return resolved;
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
