import { useEffect, useRef, useState } from 'react';

export type Mode = 'loading' | 'ready' | 'countdown' | 'recording' | 'preview' | 'error';

// How many seconds before the target duration the "wrap up" warning kicks in.
const END_WARNING_THRESHOLD = 3;

export interface CameraCaptureOptions {
  // When > 0, a 3·2·1 countdown plays before recording actually starts.
  countdownSeconds?: number;
  // The section's target duration; drives the "wrap up" warning in its last seconds.
  maxDurationSeconds?: number;
}

export type FacingMode = 'user' | 'environment';

// Prefer an MP4 container when the browser can produce it (best downstream
// compatibility), otherwise fall back to WebM.
function pickMimeType(): string | undefined {
  const candidates = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];

  if (typeof MediaRecorder === 'undefined') return undefined;

  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

const CAMERA_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: 'Camera access was denied. Allow camera + microphone permissions and try again.',
  SecurityError: 'Camera access was denied. Allow camera + microphone permissions and try again.',
  NotFoundError: 'No camera was found on this device.',
  OverconstrainedError: 'No camera was found on this device.',
  NotReadableError: 'The camera is already in use by another app.',
};

const DEFAULT_CAMERA_ERROR = 'Could not start the camera. Please check your browser permissions.';

function describeCameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';

  return CAMERA_ERROR_MESSAGES[name] ?? DEFAULT_CAMERA_ERROR;
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;

  return `${m}:${s.toString().padStart(2, '0')}`;
}

function stopTracks(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
}

// Ticks the recording timer once per second while recording is active.
function useRecordingTimer(isRecording: boolean, onTick: () => void): void {
  useEffect(() => {
    if (!isRecording) return () => {};

    const id = window.setInterval(onTick, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, [isRecording, onTick]);
}

// Revokes the given object URL when it changes or the component unmounts.
function useRevokeObjectUrl(url: string | null): void {
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
}

interface RecorderHandlers {
  onStart: () => void;
  onResult: (objectUrl: string) => void;
}

interface RecorderController {
  fileRef: React.RefObject<File | null>;
  startRecording: () => void;
  stopRecording: () => void;
  clear: () => void;
}

// Captures the active stream via MediaRecorder. The produced File is exposed
// through `fileRef`; `onResult` fires with a fresh object URL once recording
// stops so the caller can show a preview.
function useRecorder(streamRef: React.RefObject<MediaStream | null>, handlers: RecorderHandlers): RecorderController {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<File | null>(null);

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const type = mimeType ?? 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      fileRef.current = new File([blob], `recording-${Date.now()}.${ext}`, { type });
      handlers.onResult(URL.createObjectURL(blob));
    };

    recorderRef.current = recorder;
    recorder.start();
    handlers.onStart();
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const clear = () => {
    fileRef.current = null;
  };

  return { fileRef, startRecording, stopRecording, clear };
}

// Pre-record 3·2·1 countdown gate around the recorder. `start` plays the configured
// countdown (or records immediately when off); `stop` cancels a pending countdown,
// otherwise stops the recording.
function usePreRecordCountdown(
  recorderStart: () => void,
  recorderStop: () => void,
  countdownSeconds: number | undefined
) {
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const startRef = useRef(recorderStart);
  startRef.current = recorderStart;

  useEffect(() => {
    if (countdownValue === null) return () => {};

    if (countdownValue <= 0) {
      setCountdownValue(null);
      startRef.current();

      return () => {};
    }

    const id = window.setTimeout(() => {
      setCountdownValue((v) => (v === null ? null : v - 1));
    }, 1000);

    return () => {
      window.clearTimeout(id);
    };
  }, [countdownValue]);

  const start = () => {
    if (countdownSeconds && countdownSeconds > 0) {
      setCountdownValue(countdownSeconds);

      return;
    }

    startRef.current();
  };

  const stop = () => {
    if (countdownValue === null) {
      recorderStop();

      return;
    }

    setCountdownValue(null);
  };

  const cancel = () => {
    setCountdownValue(null);
  };

  return { countdownValue, start, stop, cancel };
}

// End-of-duration warning state: only active while recording and within the last
// few seconds of the target duration. `remaining` counts down to 0.
function endWarning(
  mode: Mode,
  elapsed: number,
  maxDurationSeconds: number | undefined
): { endingSoon: boolean; remaining: number } {
  if (maxDurationSeconds === undefined || maxDurationSeconds <= 0 || mode !== 'recording') {
    return { endingSoon: false, remaining: 0 };
  }

  return {
    endingSoon: elapsed >= maxDurationSeconds - END_WARNING_THRESHOLD,
    remaining: Math.max(0, maxDurationSeconds - elapsed),
  };
}

interface CameraCaptureController {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  facingMode: FacingMode;
  mode: Mode;
  error: string;
  elapsed: number;
  previewUrl: string | null;
  countdownValue: number | null;
  endingSoon: boolean;
  remaining: number;
  startCamera: () => void;
  switchCamera: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  confirmCapture: () => void;
  retake: () => void;
  cancel: () => void;
}

export function useCameraCapture(
  onCapture: (file: File) => void,
  onClose: () => void,
  options: CameraCaptureOptions = {}
): CameraCaptureController {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const [mode, setMode] = useState<Mode>('loading');
  const [error, setError] = useState<string>('');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [restartToken, setRestartToken] = useState(0);

  // (Re)start the stream whenever the facing mode or restart token changes; tear
  // down on unmount. All stream handling is inlined so the dependency list stays
  // honest (no closures whose identity would force spurious re-runs).
  useEffect(() => {
    const run = async () => {
      setMode('loading');
      stopTracks(streamRef.current);
      streamRef.current = null;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          await videoRef.current.play().catch(() => {});
        }

        setMode('ready');
      } catch (error) {
        setError(describeCameraError(error));
        setMode('error');
      }
    };

    // `run` owns its try/catch and never rejects; the trailing catch only keeps
    // this from being a floating promise.
    run().catch(() => {});

    return () => {
      stopTracks(streamRef.current);
      streamRef.current = null;
    };
  }, [facingMode, restartToken]);

  const recorder = useRecorder(streamRef, {
    onStart: () => {
      setElapsed(0);
      setMode('recording');
    },
    onResult: (objectUrl) => {
      setPreviewUrl(objectUrl);
      setMode('preview');
    },
  });

  useRecordingTimer(mode === 'recording', () => {
    setElapsed((s) => s + 1);
  });
  useRevokeObjectUrl(previewUrl);

  const countdown = usePreRecordCountdown(recorder.startRecording, recorder.stopRecording, options.countdownSeconds);

  const startCamera = () => {
    countdown.cancel();
    setRestartToken((token) => token + 1);
  };

  const switchCamera = () => {
    countdown.cancel();
    setFacingMode((m) => (m === 'user' ? 'environment' : 'user'));
  };

  const { endingSoon, remaining } = endWarning(mode, elapsed, options.maxDurationSeconds);

  const confirmCapture = () => {
    if (recorder.fileRef.current) onCapture(recorder.fileRef.current);

    stopTracks(streamRef.current);
    streamRef.current = null;
    onClose();
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(null);
    recorder.clear();
    startCamera();
  };

  const cancel = () => {
    countdown.cancel();
    stopTracks(streamRef.current);
    streamRef.current = null;
    onClose();
  };

  return {
    videoRef,
    facingMode,
    mode: countdown.countdownValue === null ? mode : 'countdown',
    error,
    elapsed,
    previewUrl,
    countdownValue: countdown.countdownValue,
    endingSoon,
    remaining,
    startCamera,
    switchCamera,
    startRecording: countdown.start,
    stopRecording: countdown.stop,
    confirmCapture,
    retake,
    cancel,
  };
}
