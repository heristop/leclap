import type { TemplateDescriptor, FramingGuideConfig } from 'ffmpeg-video-composer/src/core/types.d.ts';
import type { TemplateOrientation, CaptureMode } from '@leclap/creative-kit';

export interface RecordingConfig {
  // Seconds to count down before recording, or undefined when the countdown is off.
  countdownSeconds?: number;
  // The target clip duration, used to warn the user as the recording nears its end.
  maxDurationSeconds?: number;
  // Camera framing guide overlay — rendered in the recording UI only, never burned into video.
  framingGuide?: FramingGuideConfig;
  // Author's "what to film" instructions, shown as an on-screen hint while recording.
  description?: string;
  // Template orientation — drives the camera frame + recording aspect (9:16 portrait, 1:1 square, native
  // landscape).
  orientation?: TemplateOrientation;
  // Default capture mode when the recorder opens. Falls back to 'front'.
  defaultCaptureMode: CaptureMode;
  // Ordered list of modes the user can switch to. Falls back to all four modes.
  allowedCaptureModes: CaptureMode[];
}

// Normalize a descriptor's free-form orientation string to a supported recording orientation.
function recordingOrientation(orientation: string | undefined): RecordingConfig['orientation'] {
  if (orientation === 'portrait') return 'portrait';

  if (orientation === 'square') return 'square';

  return 'landscape';
}

// Recording-UX config drawn from the first project_video section of a template —
// the section a recorded/uploaded clip maps to. Returns empty config when the
// template has no such section.
type ProjectVideoSection = NonNullable<TemplateDescriptor['sections']>[number];

// The default-locale ('en') section description, else the first translation present.
function descriptionFrom(translation: ProjectVideoSection['description']): string | undefined {
  if (!translation) return undefined;

  return translation.en ?? Object.values(translation)[0];
}

const ALL_CAPTURE_MODES: CaptureMode[] = ['front', 'back', 'screen', 'upload'];

function countdownSecondsFrom(options: ProjectVideoSection['options']): number | undefined {
  if (!options?.countdown) return undefined;

  return options.countdownDuration ?? 4;
}

function captureMode(options: ProjectVideoSection['options']): CaptureMode {
  return (options?.captureMode as CaptureMode | undefined) ?? 'front';
}

function allowedCaptureModes(options: ProjectVideoSection['options']): CaptureMode[] {
  return (options?.allowedCaptureModes as CaptureMode[] | undefined) ?? ALL_CAPTURE_MODES;
}

// Recording-UX config for ONE specific project_video section (countdown/duration/framing/what-to-film
// all read from that section's own options) — used by the per-section clip step.
export function recordingConfigForSection(section: ProjectVideoSection | null | undefined): RecordingConfig {
  const options = section?.options;
  const description = descriptionFrom(section?.description);

  return {
    countdownSeconds: countdownSecondsFrom(options),
    maxDurationSeconds: options?.duration,
    framingGuide: options?.framingGuide,
    ...(description ? { description } : {}),
    defaultCaptureMode: captureMode(options),
    allowedCaptureModes: allowedCaptureModes(options),
  };
}

// Config drawn from the FIRST project_video section — the template-wide default for callers that
// don't operate per section.
export function recordingConfigFromDescriptor(descriptor: TemplateDescriptor | null | undefined): RecordingConfig {
  const base = recordingConfigForSection(descriptor?.sections?.find((s) => s.type === 'project_video'));

  return { ...base, orientation: recordingOrientation(descriptor?.global?.orientation) };
}
