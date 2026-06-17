import type { TemplateDescriptor } from '@/src/types';
import type { CompileRecordedVideos } from '@/src/services/api';

export interface Capability {
  capable: boolean;
  /** Why a job can't run on-device — surfaced in logs so routing decisions are explainable. */
  reason?: string;
}

/**
 * Whether a job can be produced on-device. The reused core (`ffmpeg-video-composer`) turns the
 * descriptor into the SAME ffmpeg commands it runs on Node + web, so on-device covers everything the
 * core supports: multi-section concat, color/title cards, drawtext, multiple clips, music, and
 * animation `maps[]` — now single-file APNG/WebM overlays composited through the shared filtergraph
 * (the old ZIP-frame path that needed unzip is gone). So capability is fully permissive; the gate
 * stays as a hook for any genuine future on-device limitation, and `compileHybrid` surfaces a real
 * engine error rather than pre-emptively refusing a template the core can render.
 */
export function describeOnDeviceCapability(
  _descriptor: TemplateDescriptor,
  _recordedVideos: CompileRecordedVideos
): Capability {
  return { capable: true };
}

export function isOnDeviceCapable(descriptor: TemplateDescriptor, recordedVideos: CompileRecordedVideos): boolean {
  return describeOnDeviceCapability(descriptor, recordedVideos).capable;
}
