import { createPortal } from 'react-dom';
import { SwitchCamera, X, Check, RotateCcw, Loader2, CameraOff, TimerReset } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { formatElapsed, useCameraCapture, type Mode } from '@/hooks/useCameraCapture';
import { Button } from '@/presentation/components/ui';
import { FramingGuideOverlay } from '@/presentation/components/FramingGuideOverlay';
import type { FramingGuideConfig } from 'ffmpeg-video-composer/src/core/types.d.ts';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  // When > 0, a 3·2·1 countdown plays before recording starts.
  countdownSeconds?: number;
  // The target clip duration; drives the "wrap up" warning in its last seconds.
  maxDurationSeconds?: number;
  // Camera framing guide overlay — shown over the live stream only, never burned into video.
  framingGuide?: FramingGuideConfig;
  // Author's "what to film" prompt, shown as a muted caption over the live preview.
  description?: string;
  // Template orientation: 'portrait' frames the camera as a centered 9:16 box and records vertical.
  orientation?: 'portrait' | 'landscape';
}

interface TopBarProps {
  mode: Mode;
  elapsed: number;
  onCancel: () => void;
  onSwitchCamera: () => void;
}

const CameraTopBar = ({ mode, elapsed, onCancel, onSwitchCamera }: TopBarProps) => {
  const { t } = useTranslation('media');
  const showSwitch = mode === 'ready' || mode === 'loading';
  const showSpacer = mode === 'preview' || mode === 'error';

  return (
    <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20"
        aria-label={t('camera.closeAria')}
      >
        <X />
      </Button>

      {mode === 'recording' && (
        <div className="fade-in flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/70 ring-1 ring-white/20 shadow-lg shadow-black/40">
          <span className="w-3 h-3 rounded-full bg-[var(--color-error)] animate-pulse shadow-[0_0_10px_2px_oklch(0.643_0.215_28.8/0.6)]" />
          <span className="text-lg font-bold text-white tabular-nums tracking-tight">{formatElapsed(elapsed)}</span>
        </div>
      )}

      {showSwitch && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSwitchCamera}
          className="rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20"
          aria-label={t('camera.switchAria')}
        >
          <SwitchCamera />
        </Button>
      )}

      {showSpacer && <span className="w-10" />}
    </div>
  );
};

interface ErrorViewProps {
  error: string;
  onRetry: () => void;
}

const CameraErrorView = ({ error, onRetry }: ErrorViewProps) => {
  const { t } = useTranslation('media');

  return (
    <div className="max-w-sm mx-auto text-center px-6 fade-in">
      <div className="pop-in inline-flex p-4 rounded-2xl bg-[var(--color-error)]/15 border border-[var(--color-error)]/30 mb-4">
        <CameraOff className="w-8 h-8 text-[var(--color-error)]" />
      </div>
      <h2 className="text-xl font-bold font-display text-foreground mb-2">{t('camera.unavailable')}</h2>
      <p className="text-foreground/80 mb-6 text-balance">{error}</p>
      <Button onClick={onRetry} size="lg">
        <RotateCcw /> {t('actions.tryAgain', { ns: 'common' })}
      </Button>
    </div>
  );
};

// Big centered "3·2·1" over the live preview before recording starts. The number
// is keyed so each tick re-triggers the pop-in, reading as a distinct beat.
const CountdownOverlay = ({ value }: { value: number | null }) => {
  const { t } = useTranslation('media');

  if (value === null) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/45 backdrop-blur-[2px]"
      aria-label={t('camera.recordingIn', { value })}
    >
      <div className="text-center">
        <span
          key={value}
          className="pop-in block font-display font-extrabold leading-none text-white tabular-nums text-[7rem] sm:text-[9rem] [text-shadow:0_4px_28px_oklch(0_0_0/0.6)]"
        >
          {value}
        </span>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-white/85">{t('camera.getReady')}</p>
      </div>
    </div>
  );
};

// Pulsing inset ring + "wrap up" badge shown during the last seconds of the target duration.
const EndWarningOverlay = ({ remaining }: { remaining: number }) => {
  const { t } = useTranslation('media');

  return (
    <div className="pointer-events-none absolute inset-0 z-20 fade-in" role="status" aria-live="polite">
      <div className="absolute inset-0 animate-pulse ring-4 ring-inset ring-[var(--color-error)]" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-error)] text-white shadow-lg shadow-black/40">
        <TimerReset className="w-4 h-4" />
        <span className="text-sm font-bold tabular-nums">
          {remaining > 0 ? t('camera.wrapUp', { remaining }) : t('camera.timesUp')}
        </span>
      </div>
    </div>
  );
};

// Muted "what to film" caption pinned to the bottom of the live preview — the author's
// recording instructions. Hidden on the recorded-clip review, and while the end-warning shows.
const RecordingHint = ({ text }: { text: string }) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-4 fade-in">
    <p className="max-w-md rounded-2xl bg-black/55 px-4 py-2 text-center text-sm font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-sm text-balance">
      {text}
    </p>
  </div>
);

interface StageOverlaysProps {
  mode: Mode;
  countdownValue: number | null;
  endingSoon: boolean;
  remaining: number;
  framingGuide?: FramingGuideConfig;
  description?: string;
}

// The stacked live-preview overlays, ordered so only one foreground beat shows at a time:
// the end-warning takes over from the "what to film" hint, the countdown sits on top.
const StageOverlays = ({
  mode,
  countdownValue,
  endingSoon,
  remaining,
  framingGuide,
  description,
}: StageOverlaysProps) => {
  const livePreview = mode !== 'preview' && mode !== 'loading';

  return (
    <>
      {framingGuide && mode !== 'preview' && <FramingGuideOverlay guide={framingGuide} />}
      {description && livePreview && !endingSoon && <RecordingHint text={description} />}
      {endingSoon && <EndWarningOverlay remaining={remaining} />}
      {mode === 'countdown' && <CountdownOverlay value={countdownValue} />}
    </>
  );
};

interface StageProps {
  mode: Mode;
  error: string;
  facingMode: 'user' | 'environment';
  previewUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  countdownValue: number | null;
  endingSoon: boolean;
  remaining: number;
  framingGuide?: FramingGuideConfig;
  description?: string;
  portrait: boolean;
  onRetry: () => void;
}

const CameraStage = ({
  mode,
  error,
  facingMode,
  previewUrl,
  videoRef,
  countdownValue,
  endingSoon,
  remaining,
  framingGuide,
  description,
  portrait,
  onRetry,
}: StageProps) => {
  const { t } = useTranslation('media');

  // Portrait templates: on mobile the camera fills the whole stage (full-bleed, no side gutters) and
  // `object-cover` crops it; from `sm` up it becomes a centered vertical 9:16 box (height-driven — full
  // stage height, width from the aspect). Landscape fills the stage. The recorder crops to 9:16 from the
  // camera feed regardless of this frame, so the saved clip is unaffected. Overlays live inside the
  // frame so they track its shape; `min-h-0` on the stage lets the child's `h-full` resolve under flex.
  const frameClass = portrait
    ? 'relative h-full w-full overflow-hidden sm:mx-auto sm:w-auto sm:max-w-full sm:aspect-[9/16]'
    : 'relative w-full h-full';

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {mode === 'error' ? (
        <CameraErrorView error={error} onRetry={onRetry} />
      ) : (
        <>
          <div className={frameClass}>
            {/* Live preview (hidden while reviewing the recording) */}
            <video
              ref={videoRef}
              aria-label={t('camera.livePreviewAria')}
              playsInline
              autoPlay
              muted
              className={clsx(
                'w-full h-full object-cover transition-opacity duration-300',
                facingMode === 'user' && '-scale-x-100',
                mode === 'preview' ? 'opacity-0 absolute' : 'opacity-100'
              )}
            />

            {mode === 'preview' && previewUrl && (
              <video
                src={previewUrl}
                aria-label={t('camera.recordedPreviewAria')}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-contain bg-black"
              />
            )}

            <StageOverlays
              mode={mode}
              countdownValue={countdownValue}
              endingSoon={endingSoon}
              remaining={remaining}
              framingGuide={framingGuide}
              description={description}
            />
          </div>

          {mode === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-foreground/80">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">{t('camera.starting')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface ControlsProps {
  mode: Mode;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onConfirm: () => void;
  onRetake: () => void;
}

const PreviewControls = ({ onConfirm, onRetake }: Pick<ControlsProps, 'onConfirm' | 'onRetake'>) => {
  const { t } = useTranslation('media');

  return (
    <div className="flex items-center justify-center gap-4">
      <Button onClick={onRetake} variant="secondary" size="lg">
        <RotateCcw /> {t('camera.retake')}
      </Button>
      <Button onClick={onConfirm} size="lg">
        <Check /> {t('camera.useVideo')}
      </Button>
    </div>
  );
};

function recordButtonLabel(mode: Mode, t: TFunction<'media'>): string {
  if (mode === 'countdown') return t('camera.cancelCountdown');

  if (mode === 'recording') return t('camera.stopRecording');

  return t('camera.startRecording');
}

const RecordControls = ({
  mode,
  onStartRecording,
  onStopRecording,
}: Pick<ControlsProps, 'mode' | 'onStartRecording' | 'onStopRecording'>) => {
  const { t } = useTranslation('media');
  const active = mode === 'recording' || mode === 'countdown';

  return (
    <div className="flex items-center justify-center">
      <button
        onClick={active ? onStopRecording : onStartRecording}
        disabled={mode === 'loading'}
        aria-label={recordButtonLabel(mode, t)}
        className={clsx(
          'tap relative grid place-items-center w-[4.5rem] h-[4.5rem] rounded-full border-4 border-foreground/80 transition-all duration-300 ease-[var(--ease-spring)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          mode === 'loading'
            ? 'opacity-50'
            : 'hover:border-white hover:shadow-[0_0_24px_-4px_oklch(0.643_0.215_28.8/0.6)] active:scale-90'
        )}
      >
        <span
          className={clsx(
            'bg-[var(--color-error)] transition-all duration-300 ease-[var(--ease-spring)]',
            active ? 'w-7 h-7 rounded-md' : 'w-14 h-14 rounded-full'
          )}
        />
      </button>
    </div>
  );
};

const CameraControls = ({ mode, onStartRecording, onStopRecording, onConfirm, onRetake }: ControlsProps) => {
  if (mode === 'error') return null;

  return (
    <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
      {mode === 'preview' ? (
        <PreviewControls onConfirm={onConfirm} onRetake={onRetake} />
      ) : (
        <RecordControls mode={mode} onStartRecording={onStartRecording} onStopRecording={onStopRecording} />
      )}
    </div>
  );
};

export const CameraCapture = ({
  onCapture,
  onClose,
  countdownSeconds,
  maxDurationSeconds,
  framingGuide,
  description,
  orientation = 'landscape',
}: CameraCaptureProps) => {
  const portrait = orientation === 'portrait';
  const camera = useCameraCapture(onCapture, onClose, { countdownSeconds, maxDurationSeconds, portrait });

  return createPortal(
    // Fullscreen camera: the stage fills the whole viewport edge-to-edge; the top bar and record
    // controls float on top with gradient scrims for legibility (native-camera-app style).
    <div className="dark fixed inset-0 z-[60] bg-black fade-in">
      <CameraStage
        mode={camera.mode}
        error={camera.error}
        facingMode={camera.facingMode}
        previewUrl={camera.previewUrl}
        videoRef={camera.videoRef}
        countdownValue={camera.countdownValue}
        endingSoon={camera.endingSoon}
        remaining={camera.remaining}
        framingGuide={framingGuide}
        description={description}
        portrait={portrait}
        onRetry={camera.startCamera}
      />

      <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 to-transparent pb-8">
        <CameraTopBar
          mode={camera.mode}
          elapsed={camera.elapsed}
          onCancel={camera.cancel}
          onSwitchCamera={camera.switchCamera}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/55 to-transparent pt-8 safe-b">
        <CameraControls
          mode={camera.mode}
          onStartRecording={camera.startRecording}
          onStopRecording={camera.stopRecording}
          onConfirm={camera.confirmCapture}
          onRetake={camera.retake}
        />
      </div>
    </div>,
    document.body
  );
};
