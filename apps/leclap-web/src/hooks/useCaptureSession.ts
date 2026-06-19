import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureMode, TemplateOrientation } from '@leclap/creative-kit';
import { useCameraCapture } from './useCameraCapture';

export type CaptureState = 'loading' | 'idle' | 'countdown' | 'recording' | 'preview' | 'error';

export interface CaptureSessionConfig {
  defaultMode: CaptureMode;
  allowedModes: CaptureMode[];
  countdown?: number;
  maxDuration?: number;
  orientation?: TemplateOrientation;
}

export interface CaptureSessionReturn {
  mode: CaptureMode;
  setMode: (m: CaptureMode) => void;
  /** All modes the user can switch to — pass directly to the mode tab bar. */
  allowedModes: CaptureMode[];
  /** Live display stream for screen mode; null in camera/upload mode (camera uses videoRef). */
  previewStream: MediaStream | null;
  state: CaptureState;
  /** Camera modes: triggers countdown then recording. Screen: starts recording. Upload: opens file picker. */
  start: () => void;
  stop: () => void;
  /** File produced by record/upload; null while idle or recording. */
  result: File | null;
  /** Confirm and accept the captured result (calls underlying confirmCapture for camera). */
  confirm: () => void;
  /** Retake / discard current result and go back to ready state. */
  retake: () => void;
  /** Open the file picker — no-op unless mode === 'upload'. */
  openFilePicker: () => void;
  /** videoRef for camera modes — attach to the <video> preview element. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Timer seconds elapsed during recording. */
  elapsed: number;
  /** True when nearing maxDuration (last ~3s). */
  endingSoon: boolean;
  /** Countdown value (null when not counting down). */
  countdownValue: number | null;
  error: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickMimeType(): string | undefined {
  const candidates = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];

  if (typeof MediaRecorder === 'undefined') return undefined;

  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

function stopTracks(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
}

// Map camera's 'ready' to the unified 'idle' state label.
function mapCameraState(m: 'loading' | 'ready' | 'countdown' | 'recording' | 'preview' | 'error'): CaptureState {
  if (m === 'ready') return 'idle';

  return m;
}

// ── useScreenCapture ──────────────────────────────────────────────────────────

interface ScreenCaptureController {
  stream: MediaStream | null;
  state: CaptureState;
  file: File | null;
  elapsed: number;
  error: string;
  start: () => void;
  stop: () => void;
  retake: () => void;
}

function useScreenCapture(active: boolean): ScreenCaptureController {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<CaptureState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Keep a ref so the cleanup effect can stop tracks without the stream in deps
  // (adding it would cause a loop: effect sets stream → stream changes → re-run).
  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = stream;

  // Tear down when deactivated
  useEffect(() => {
    if (active) return () => {};

    stopTracks(streamRef.current);
    setStream(null);
    setState('idle');
    setFile(null);
    setElapsed(0);
    setError('');

    return () => {};
  }, [active]);

  // Acquire display media when activated
  useEffect(() => {
    if (!active) return () => {};

    let cancelled = false;

    const acquire = async () => {
      try {
        const acquired = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

        if (cancelled) {
          stopTracks(acquired);

          return;
        }

        setStream(acquired);
        setState('idle');
      } catch {
        if (!cancelled) {
          setError('Screen sharing was denied or cancelled.');
          setState('error');
        }
      }
    };

    acquire().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [active]);

  // Recording timer
  useEffect(() => {
    if (state !== 'recording') return () => {};

    const id = window.setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, [state]);

  const start = useCallback(() => {
    if (!stream) return;

    const mimeType = pickMimeType();
    chunksRef.current = [];

    let recorder: MediaRecorder;

    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      setError("Couldn't start screen recording on this device.");
      setState('error');

      return;
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onerror = () => {
      setError("Couldn't start screen recording on this device.");
      setState('error');
    };

    recorder.onstop = () => {
      const type = mimeType ?? 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      setFile(new File([blob], `screen-${Date.now()}.${ext}`, { type }));
      setState('preview');
    };

    try {
      recorder.start();
    } catch {
      setError("Couldn't start screen recording on this device.");
      setState('error');

      return;
    }

    recorderRef.current = recorder;
    setElapsed(0);
    setState('recording');
  }, [stream]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  const retake = useCallback(() => {
    setFile(null);
    setState('idle');
  }, []);

  return { stream, state, file, elapsed, error, start, stop, retake };
}

// ── useUploadCapture ──────────────────────────────────────────────────────────

interface UploadCaptureController {
  file: File | null;
  openPicker: () => void;
  retake: () => void;
}

function useUploadCapture(): UploadCaptureController {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      setFile(input.files?.[0] ?? null);
    });
    document.body.appendChild(input);
    inputRef.current = input;

    return () => {
      document.body.removeChild(input);
      inputRef.current = null;
    };
  }, []);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const retake = useCallback(() => {
    setFile(null);

    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return { file, openPicker, retake };
}

// ── Derived unified values ────────────────────────────────────────────────────

interface DerivedValues {
  state: CaptureState;
  result: File | null;
  elapsed: number;
  endingSoon: boolean;
  countdownValue: number | null;
  error: string;
}

function deriveForCamera(camera: ReturnType<typeof useCameraCapture>, capturedFile: File | null): DerivedValues {
  return {
    state: mapCameraState(camera.mode),
    result: capturedFile,
    elapsed: camera.elapsed,
    endingSoon: camera.endingSoon,
    countdownValue: camera.countdownValue,
    error: camera.error,
  };
}

function deriveForScreen(screen: ScreenCaptureController): DerivedValues {
  return {
    state: screen.state,
    result: screen.file,
    elapsed: screen.elapsed,
    endingSoon: false,
    countdownValue: null,
    error: screen.error,
  };
}

function deriveForUpload(uploadFile: File | null): DerivedValues {
  return {
    state: uploadFile ? 'preview' : 'idle',
    result: uploadFile,
    elapsed: 0,
    endingSoon: false,
    countdownValue: null,
    error: '',
  };
}

// ── useCaptureSession ─────────────────────────────────────────────────────────

export function useCaptureSession(config: CaptureSessionConfig): CaptureSessionReturn {
  const [mode, setModeState] = useState<CaptureMode>(config.defaultMode);

  const capturedFileRef = useRef<File | null>(null);

  const handleCameraCapture = useCallback((file: File) => {
    capturedFileRef.current = file;
  }, []);

  // Always call all sub-hooks unconditionally (Rules of Hooks)
  const camera = useCameraCapture(handleCameraCapture, () => {}, {
    countdownSeconds: config.countdown,
    maxDurationSeconds: config.maxDuration,
    orientation: config.orientation,
  });

  const screen = useScreenCapture(mode === 'screen');
  const upload = useUploadCapture();

  const isCameraMode = mode === 'front' || mode === 'back';

  const setMode = useCallback(
    (m: CaptureMode) => {
      if (m === mode) return;

      capturedFileRef.current = null;

      if (m === 'front' && camera.facingMode !== 'user') camera.switchCamera();

      if (m === 'back' && camera.facingMode !== 'environment') camera.switchCamera();

      setModeState(m);
    },
    [mode, camera]
  );

  // Derive unified state from the active sub-controller
  function derivedValues(): DerivedValues {
    if (isCameraMode) return deriveForCamera(camera, capturedFileRef.current);

    if (mode === 'screen') return deriveForScreen(screen);

    return deriveForUpload(upload.file);
  }

  const derived = derivedValues();

  const start = useCallback(() => {
    if (isCameraMode) {
      camera.startRecording();

      return;
    }

    if (mode === 'screen') {
      screen.start();

      return;
    }

    upload.openPicker();
  }, [isCameraMode, mode, camera, screen, upload]);

  const stop = useCallback(() => {
    if (isCameraMode) {
      camera.stopRecording();

      return;
    }

    if (mode === 'screen') screen.stop();
  }, [isCameraMode, mode, camera, screen]);

  const confirm = useCallback(() => {
    if (isCameraMode) camera.confirmCapture();
    // screen/upload: result is already in state; consumer reads `result` directly
  }, [isCameraMode, camera]);

  const retake = useCallback(() => {
    capturedFileRef.current = null;

    if (isCameraMode) {
      camera.retake();

      return;
    }

    if (mode === 'screen') {
      screen.retake();

      return;
    }

    upload.retake();
  }, [isCameraMode, mode, camera, screen, upload]);

  const openFilePicker = useCallback(() => {
    if (mode !== 'upload') return;

    upload.openPicker();
  }, [mode, upload]);

  return {
    mode,
    setMode,
    allowedModes: config.allowedModes,
    previewStream: mode === 'screen' ? screen.stream : null,
    state: derived.state,
    start,
    stop,
    result: derived.result,
    confirm,
    retake,
    openFilePicker,
    videoRef: camera.videoRef,
    elapsed: derived.elapsed,
    endingSoon: derived.endingSoon,
    countdownValue: derived.countdownValue,
    error: derived.error,
  };
}
