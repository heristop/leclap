import type { ProjectBuildInfos, Section, TemplateDescriptorGlobal } from '@/core/types';
import { FFmpegError } from '../core/errors/FFmpegError';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import { hasWholeVideoOverlays } from '../editor/presets/watermark';

// The finalize steps one compile runs, read once music has loaded and the transitions are built.
// Shared by the finalize path selection and the probe pre-flight so the two can't disagree.
export interface RenderNeeds {
  /** Any non-cut boundary sends the join through the xfade assembly. */
  hasTransition: boolean;
  /** Whole-video overlays (global.animations or the watermark), composited over the joined video. */
  hasAnimations: boolean;
  /** Music mixes only when enabled AND a track resolved — loadMusic leaves musicPath empty otherwise. */
  musicWillRun: boolean;
}

export function renderNeeds(global: TemplateDescriptorGlobal | undefined, buildInfos: ProjectBuildInfos): RenderNeeds {
  return {
    hasTransition: buildInfos.transitions.some((transition) => transition.type !== 'cut'),
    hasAnimations: hasWholeVideoOverlays(global),
    musicWillRun: Boolean(global?.musicEnabled) && Boolean(buildInfos.musicPath),
  };
}

// Each of those steps probes media through getInfos, and so does reading a project_video clip's length.
// When the adapter can't probe at all (ffmpeg-static without ffprobe), stop before the first segment
// encodes: the join would otherwise fail only once every segment has rendered, and a clip's failed
// probe falls back to its declared duration with its audio replaced by silence.
export function assertCanProbe(ffmpegAdapter: AbstractFFmpeg, needs: RenderNeeds, segments: Section[]): void {
  const reason = ffmpegAdapter.probeUnavailableReason;
  const probes =
    needs.hasTransition ||
    needs.hasAnimations ||
    needs.musicWillRun ||
    segments.some((section) => section.type === 'project_video');

  if (!reason || !probes) {
    return;
  }

  throw new FFmpegError(reason);
}
