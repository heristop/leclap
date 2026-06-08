import type { TemplateDescriptor } from '@/src/types';
import type { CompileRecordedVideos } from '@/src/services/api';

export interface Capability {
  capable: boolean;
  /** Why a job can't run on-device — surfaced in logs so routing decisions are explainable. */
  reason?: string;
}

/**
 * Whether a job can be produced **correctly** by the on-device engine.
 *
 * Deliberately strict: ffmpeg-expo currently only remuxes (stream-copies) a single input — it
 * applies no filters and never re-encodes. So the only fully-correct on-device case is a single,
 * untransformed `project_video` clip. Everything else (overlays, trim, crop, mute, duration caps,
 * color cards, multiple clips, transitions, music) needs real re-encoding and routes to the server.
 *
 * When the on-device engine gains a real filtergraph executor, relax these checks accordingly.
 */
export function describeOnDeviceCapability(
  descriptor: TemplateDescriptor,
  recordedVideos: CompileRecordedVideos
): Capability {
  const sections = descriptor.sections ?? [];

  if (sections.length !== 1) {
    return { capable: false, reason: 'multiple sections require concat/transitions (server)' };
  }

  const section = sections[0];

  if (section.type !== 'project_video') {
    return { capable: false, reason: `section type "${section.type}" needs rendering (server)` };
  }

  if ((section.filters?.length ?? 0) > 0) {
    return { capable: false, reason: 'text/overlay filters require re-encode (server)' };
  }

  if (section.options?.muteSection) {
    return { capable: false, reason: 'muting requires re-encode (server)' };
  }

  if (section.options?.duration !== undefined) {
    return { capable: false, reason: 'duration trim requires re-encode (server)' };
  }

  const clips = Object.values(recordedVideos);

  if (clips.length !== 1) {
    return { capable: false, reason: 'exactly one recorded clip required for on-device (server)' };
  }

  const clip = clips[0];

  if (clip.trim || clip.crop) {
    return { capable: false, reason: `${clip.trim ? 'trim' : 'crop'} requires re-encode (server)` };
  }

  return { capable: true };
}

export function isOnDeviceCapable(descriptor: TemplateDescriptor, recordedVideos: CompileRecordedVideos): boolean {
  return describeOnDeviceCapability(descriptor, recordedVideos).capable;
}
