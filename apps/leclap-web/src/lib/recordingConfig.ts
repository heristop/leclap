import type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';

export interface RecordingConfig {
  // Seconds to count down before recording, or undefined when the countdown is off.
  countdownSeconds?: number;
  // The target clip duration, used to warn the user as the recording nears its end.
  maxDurationSeconds?: number;
}

// Recording-UX config drawn from the first project_video section of a template —
// the section a recorded/uploaded clip maps to. Returns empty config when the
// template has no such section.
export function recordingConfigFromDescriptor(descriptor: TemplateDescriptor | null | undefined): RecordingConfig {
  const options = descriptor?.sections?.find((s) => s.type === 'project_video')?.options;

  return {
    countdownSeconds: options?.countdown ? (options.countdownDuration ?? 4) : undefined,
    maxDurationSeconds: options?.duration,
  };
}
