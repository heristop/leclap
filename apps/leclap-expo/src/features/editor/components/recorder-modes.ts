import type { CaptureMode } from '@leclap/creative-kit';

// The modes the phone recorder offers for a project_video section, from its `captureMode` /
// `allowedCaptureModes` options. Omitted, every mode the phone supports is available (as the schema
// says: "omit for all"), so a clip can always come from the gallery as well as either camera. Screen
// capture is a desktop mode and is never offered here.
const PHONE_MODES: readonly CaptureMode[] = ['front', 'back', 'upload'];

interface CaptureOptions {
  captureMode?: CaptureMode;
  allowedCaptureModes?: CaptureMode[];
}

export function recorderModes(options: CaptureOptions | undefined): { modes: CaptureMode[]; initial: CaptureMode } {
  const authored = (options?.allowedCaptureModes ?? []).filter((mode) => PHONE_MODES.includes(mode));
  const modes = authored.length > 0 ? authored : [...PHONE_MODES];
  const preferred = options?.captureMode;
  const initial = preferred && modes.includes(preferred) ? preferred : modes[0];

  return { modes, initial };
}

/** The same choice as VideoRecorder props, for the record screen to spread. */
export function recorderModeProps(options: CaptureOptions | undefined): {
  allowedModes: CaptureMode[];
  initialMode: CaptureMode;
} {
  const { modes, initial } = recorderModes(options);

  return { allowedModes: modes, initialMode: initial };
}
