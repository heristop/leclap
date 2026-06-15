import type { TemplateDescriptor, Section } from '@/src/types';
import type { CompileRecordedVideos } from '@/src/services/api';

export interface Capability {
  capable: boolean;
  /** Why a job can't run on-device — surfaced in logs so routing decisions are explainable. */
  reason?: string;
}

/**
 * Whether a job can be produced on-device. The reused core (`ffmpeg-video-composer`) turns the
 * descriptor into the SAME ffmpeg commands it runs on Node + web, so on-device covers everything the
 * core supports: multi-section concat, color/title cards, drawtext, multiple clips, music. The only
 * thing the native engine can't do yet is animation `maps` (ZIP frame overlays — unzip is
 * unsupported). `compileHybrid` uses this gate to fail fast with a clear error instead of producing
 * a broken video.
 */
export function describeOnDeviceCapability(
  descriptor: TemplateDescriptor,
  _recordedVideos: CompileRecordedVideos
): Capability {
  const sections = descriptor.sections ?? [];
  const withMaps = sections.find((s: Section) => Array.isArray(s.maps) && s.maps.length > 0);

  if (withMaps) {
    return { capable: false, reason: `section "${withMaps.name}" uses animation maps (server)` };
  }

  return { capable: true };
}

export function isOnDeviceCapable(descriptor: TemplateDescriptor, recordedVideos: CompileRecordedVideos): boolean {
  return describeOnDeviceCapability(descriptor, recordedVideos).capable;
}
