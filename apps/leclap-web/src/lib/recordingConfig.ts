import type { TemplateDescriptor, FramingGuideConfig } from 'ffmpeg-video-composer/src/core/types.d.ts';

export interface RecordingConfig {
  // Seconds to count down before recording, or undefined when the countdown is off.
  countdownSeconds?: number;
  // The target clip duration, used to warn the user as the recording nears its end.
  maxDurationSeconds?: number;
  // Camera framing guide overlay — rendered in the recording UI only, never burned into video.
  framingGuide?: FramingGuideConfig;
  // Author's "what to film" instructions, shown as an on-screen hint while recording.
  description?: string;
  // Template orientation — drives a vertical 9:16 camera frame + recording for portrait templates.
  orientation?: 'portrait' | 'landscape';
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

// Recording-UX config for ONE specific project_video section (countdown/duration/framing/what-to-film
// all read from that section's own options) — used by the per-section clip step.
export function recordingConfigForSection(section: ProjectVideoSection | null | undefined): RecordingConfig {
  const options = section?.options;
  const description = descriptionFrom(section?.description);

  return {
    countdownSeconds: options?.countdown ? (options.countdownDuration ?? 4) : undefined,
    maxDurationSeconds: options?.duration,
    framingGuide: options?.framingGuide,
    ...(description ? { description } : {}),
  };
}

// Config drawn from the FIRST project_video section — the template-wide default for callers that
// don't operate per section.
export function recordingConfigFromDescriptor(descriptor: TemplateDescriptor | null | undefined): RecordingConfig {
  const base = recordingConfigForSection(descriptor?.sections?.find((s) => s.type === 'project_video'));

  return { ...base, orientation: descriptor?.global?.orientation === 'portrait' ? 'portrait' : 'landscape' };
}
