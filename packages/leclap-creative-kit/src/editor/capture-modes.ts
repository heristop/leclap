// Pure capture-mode selection logic for the project_video section builder: which recorder modes the
// end-user may pick (allowedCaptureModes) and which one the recorder opens on (captureMode). Both are
// recorder metadata only — never lowered to FFmpeg filters. Kept UI-free so it's unit-testable.
import { ALL_CAPTURE_MODES, type CaptureMode } from './model';

export interface CaptureSelection {
  captureMode?: CaptureMode;
  allowedCaptureModes?: CaptureMode[];
}

// The effective allowed set: an unset/empty restriction means all four modes.
export function allowedSetFrom(allowed: CaptureMode[] | undefined): CaptureMode[] {
  if (!allowed || allowed.length === 0) return [...ALL_CAPTURE_MODES];

  return allowed;
}

// The mode the recorder will open on: the stored default when still allowed, else front when
// allowed (the recorder fallback), else the first allowed mode.
export function effectiveModeFrom(selection: CaptureSelection): CaptureMode {
  const allowed = allowedSetFrom(selection.allowedCaptureModes);

  if (selection.captureMode && allowed.includes(selection.captureMode)) return selection.captureMode;

  if (allowed.includes('front')) return 'front';

  return allowed[0];
}

// Normalize a selection to the minimal descriptor form: a full allowed set is dropped (= all four);
// a front default with front allowed is dropped (the recorder default); and when front is excluded
// an explicit default is pinned so the recorder never opens on a disallowed mode.
function normalize(selection: CaptureSelection): CaptureSelection {
  const allowed = allowedSetFrom(selection.allowedCaptureModes);
  const restricted = allowed.length < ALL_CAPTURE_MODES.length;
  const mode = effectiveModeFrom({ ...selection, allowedCaptureModes: allowed });

  return {
    captureMode: mode === 'front' ? undefined : mode,
    allowedCaptureModes: restricted ? allowed : undefined,
  };
}

// Toggle one mode in the allowed set. The set can never go empty — toggling off the last mode is a
// no-op. Order is canonical (front/back/screen/upload) regardless of click order.
export function toggleAllowedMode(selection: CaptureSelection, mode: CaptureMode): CaptureSelection {
  const allowed = allowedSetFrom(selection.allowedCaptureModes);
  const isOn = allowed.includes(mode);

  if (isOn && allowed.length === 1) return { ...selection };

  const next = ALL_CAPTURE_MODES.filter((m) => (m === mode ? !isOn : allowed.includes(m)));

  return normalize({ captureMode: selection.captureMode, allowedCaptureModes: next });
}

// Pick the default mode the recorder opens on. Picking front (the engine default) clears the field.
export function pickDefaultMode(selection: CaptureSelection, mode: CaptureMode): CaptureSelection {
  return normalize({ captureMode: mode, allowedCaptureModes: selection.allowedCaptureModes });
}
