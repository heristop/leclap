import { createPortal } from 'react-dom';
import { SwitchCamera, X, Check, RotateCcw, Loader2, CameraOff } from 'lucide-react';
import clsx from 'clsx';
import { formatElapsed, useCameraCapture, type Mode } from '@/hooks/useCameraCapture';
import { Button } from '@/presentation/components/ui';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

interface TopBarProps {
  mode: Mode;
  elapsed: number;
  onCancel: () => void;
  onSwitchCamera: () => void;
}

const CameraTopBar = ({ mode, elapsed, onCancel, onSwitchCamera }: TopBarProps) => {
  const showSwitch = mode === 'ready' || mode === 'loading';
  const showSpacer = mode === 'preview' || mode === 'error';

  return (
    <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20"
        aria-label="Close camera"
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
          aria-label="Switch camera"
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

const CameraErrorView = ({ error, onRetry }: ErrorViewProps) => (
  <div className="max-w-sm mx-auto text-center px-6 fade-in">
    <div className="pop-in inline-flex p-4 rounded-2xl bg-[var(--color-error)]/15 border border-[var(--color-error)]/30 mb-4">
      <CameraOff className="w-8 h-8 text-[var(--color-error)]" />
    </div>
    <h2 className="text-xl font-bold font-display text-foreground mb-2">Camera unavailable</h2>
    <p className="text-foreground/80 mb-6 text-balance">{error}</p>
    <Button onClick={onRetry} size="lg">
      <RotateCcw /> Try again
    </Button>
  </div>
);

interface StageProps {
  mode: Mode;
  error: string;
  facingMode: 'user' | 'environment';
  previewUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onRetry: () => void;
}

const CameraStage = ({ mode, error, facingMode, previewUrl, videoRef, onRetry }: StageProps) => (
  <div className="relative flex-1 flex items-center justify-center overflow-hidden">
    {mode === 'error' ? (
      <CameraErrorView error={error} onRetry={onRetry} />
    ) : (
      <>
        {/* Live preview (hidden while reviewing the recording) */}
        <video
          ref={videoRef}
          aria-label="Live camera preview"
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
            aria-label="Recorded video preview"
            controls
            autoPlay
            loop
            playsInline
            className="w-full h-full object-contain bg-black"
          />
        )}

        {mode === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-foreground/80">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Starting camera…</p>
          </div>
        )}
      </>
    )}
  </div>
);

interface ControlsProps {
  mode: Mode;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onConfirm: () => void;
  onRetake: () => void;
}

const PreviewControls = ({ onConfirm, onRetake }: Pick<ControlsProps, 'onConfirm' | 'onRetake'>) => (
  <div className="flex items-center justify-center gap-4">
    <Button onClick={onRetake} variant="secondary" size="lg">
      <RotateCcw /> Retake
    </Button>
    <Button onClick={onConfirm} size="lg">
      <Check /> Use Video
    </Button>
  </div>
);

const RecordControls = ({
  mode,
  onStartRecording,
  onStopRecording,
}: Pick<ControlsProps, 'mode' | 'onStartRecording' | 'onStopRecording'>) => {
  const isRecording = mode === 'recording';

  return (
    <div className="flex items-center justify-center">
      <button
        onClick={isRecording ? onStopRecording : onStartRecording}
        disabled={mode === 'loading'}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
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
            isRecording ? 'w-7 h-7 rounded-md' : 'w-14 h-14 rounded-full'
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

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const camera = useCameraCapture(onCapture, onClose);

  return createPortal(
    <div className="dark fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex flex-col fade-in safe-b">
      <CameraTopBar
        mode={camera.mode}
        elapsed={camera.elapsed}
        onCancel={camera.cancel}
        onSwitchCamera={camera.switchCamera}
      />

      <CameraStage
        mode={camera.mode}
        error={camera.error}
        facingMode={camera.facingMode}
        previewUrl={camera.previewUrl}
        videoRef={camera.videoRef}
        onRetry={camera.startCamera}
      />

      <CameraControls
        mode={camera.mode}
        onStartRecording={camera.startRecording}
        onStopRecording={camera.stopRecording}
        onConfirm={camera.confirmCapture}
        onRetake={camera.retake}
      />
    </div>,
    document.body
  );
};
