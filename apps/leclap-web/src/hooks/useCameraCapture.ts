import { useEffect, useRef, useState } from 'react';

export type Mode = 'loading' | 'ready' | 'countdown' | 'recording' | 'preview' | 'error';

// How many seconds before the target duration the "wrap up" warning kicks in.
const END_WARNING_THRESHOLD = 3;

export interface CameraCaptureOptions {
  // When > 0, a 3·2·1 countdown plays before recording actually starts.
  countdownSeconds?: number;
  // The section's target duration; drives the "wrap up" warning in its last seconds.
  maxDurationSeconds?: number;
  // Portrait template: request and record a 9:16 frame so the clip matches the vertical output.
  portrait?: boolean;
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

// Round down to the nearest even integer. Android hardware video encoders (H.264 via MediaRecorder)
// require even width/height and crash on odd ones — so the canvas the recorder captures must be even.
const even = (n: number): number => Math.max(2, Math.floor(n / 2) * 2);

// Center-crop rectangle of a wxh source for a target aspect ratio (e.g. 9/16 for a portrait
// template). Matches the live preview's object-cover so the saved file shows the same framing.
// sw/sh are forced even so the recorder's canvas dimensions are encoder-safe on mobile.
export function cropRect(
  w: number,
  h: number,
  targetAspect: number
): { sx: number; sy: number; sw: number; sh: number } {
  const wide = w / h > targetAspect;
  const sw = even(wide ? h * targetAspect : w);
  const sh = even(wide ? h : w / targetAspect);

  return { sx: Math.round((w - sw) / 2), sy: Math.round((h - sh) / 2), sw, sh };
}

// Builds a recordable stream from the live video via a canvas, so the saved file matches the
// preview: optionally horizontally flipped (front-camera selfie) and/or center-cropped to a 9:16
// portrait frame for portrait templates. Reuses the original audio track(s).
function createCanvasStream(
  video: HTMLVideoElement,
  source: MediaStream,
  opts: { mirror: boolean; portrait: boolean }
): { stream: MediaStream; stop: () => void } {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const { sx, sy, sw, sh } = cropRect(vw, vh, opts.portrait ? 9 / 16 : vw / vh);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');

  if (opts.mirror) {
    ctx?.translate(sw, 0);
    ctx?.scale(-1, 1);
  }

  let raf = 0;
  const draw = (): void => {
    ctx?.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    raf = requestAnimationFrame(draw);
  };
  // Paint one frame synchronously before capturing, so MediaRecorder never starts on a blank canvas
  // (some Android builds stall/error when the captured stream has produced no frame yet).
  draw();

  const stream = canvas.captureStream(30);

  for (const track of source.getAudioTracks()) {
    stream.addTrack(track);
  }

  return {
    stream,
    stop: () => {
      cancelAnimationFrame(raf);

      for (const track of stream.getVideoTracks()) {
        track.stop();
      }
    },
  };
}

// The stream to feed MediaRecorder: a cropped/mirrored canvas when the saved file must differ from the
// raw track (mirrored front-camera selfie and/or 9:16 portrait crop), otherwise the raw source. `stop`
// is a no-op for the raw path so callers can always call it.
function buildRecordStream(
  source: MediaStream,
  video: HTMLVideoElement | null,
  mirror: boolean,
  portrait: boolean
): { stream: MediaStream; stop: () => void } {
  if ((mirror || portrait) && video) return createCanvasStream(video, source, { mirror, portrait });

  return { stream: source, stop: () => {} };
}

// Shown when MediaRecorder fails to start or errors mid-record (e.g. a codec/encoder the device can't
// satisfy). Surfaced through the error view instead of letting the throw crash the recorder.
const RECORD_ERROR = "Couldn't start recording on this device. Try again, or switch camera.";

interface RecorderHandlers {
  onStart: () => void;
  onResult: (objectUrl: string) => void;
  onError: (message: string) => void;
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
function useRecorder(
  streamRef: React.RefObject<MediaStream | null>,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  mirror: boolean,
  portrait: boolean,
  handlers: RecorderHandlers
): RecorderController {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<File | null>(null);
  const mirrorStopRef = useRef<(() => void) | null>(null);

  // If recording is torn down without a clean stop (cancel / unmount mid-record), kill the mirror
  // draw loop so it doesn't keep running against a detached video element.
  useEffect(() => {
    return () => {
      mirrorStopRef.current?.();
      mirrorStopRef.current = null;
    };
  }, []);

  // Tear down the canvas loop and surface the error view instead of letting a throw crash the page —
  // MediaRecorder construction/start can throw (unsupported codec) and the encoder can die mid-record
  // (onerror), both common on mobile hardware encoders.
  const failRecording = (): void => {
    mirrorStopRef.current?.();
    mirrorStopRef.current = null;
    handlers.onError(RECORD_ERROR);
  };

  // Build + configure the recorder (handlers wired) or return null if construction throws.
  const makeRecorder = (source: MediaStream): MediaRecorder | null => {
    chunksRef.current = [];
    const mimeType = pickMimeType();

    // Everything that can throw lives in the try: `canvas.captureStream` (Safari/iOS only ≥16.4) and
    // the MediaRecorder constructor (unsupported codec). A failure surfaces the error view, not a crash.
    try {
      const { stream, stop } = buildRecordStream(source, videoRef.current, mirror, portrait);
      mirrorStopRef.current = stop;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = failRecording;
      recorder.onstop = () => {
        const type = mimeType ?? 'video/webm';
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        fileRef.current = new File([blob], `recording-${Date.now()}.${ext}`, { type });
        mirrorStopRef.current?.();
        mirrorStopRef.current = null;
        handlers.onResult(URL.createObjectURL(blob));
      };

      return recorder;
    } catch {
      failRecording();

      return null;
    }
  };

  const startRecording = () => {
    const source = streamRef.current;

    if (!source) return;

    const recorder = makeRecorder(source);

    if (!recorder) return;

    recorderRef.current = recorder;

    try {
      recorder.start();
    } catch {
      failRecording();

      return;
    }

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
      // Complete straight from 1 — the countdown never displays 0.
      if (countdownValue <= 1) {
        setCountdownValue(null);
        startRef.current();

        return;
      }

      setCountdownValue(countdownValue - 1);
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
        // Ask for a portrait frame on portrait templates (honored on mobile; desktop webcams stay
        // landscape and get center-cropped to 9:16 when recording).
        const ideal = options.portrait
          ? { width: { ideal: 720 }, height: { ideal: 1280 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } };
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, ...ideal },
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
  }, [facingMode, restartToken, options.portrait]);

  const recorder = useRecorder(streamRef, videoRef, facingMode === 'user', options.portrait ?? false, {
    onStart: () => {
      setElapsed(0);
      setMode('recording');
    },
    onResult: (objectUrl) => {
      setPreviewUrl(objectUrl);
      setMode('preview');
    },
    onError: (message) => {
      setError(message);
      setMode('error');
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
