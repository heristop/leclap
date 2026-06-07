import { Crop, Scissors, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type VideoEdit } from '@/domain/valueObjects/videoEdits';
import { TrimBar } from '@/features/editor/components/TrimBar';
import { CropFrame } from '@/features/editor/components/CropFrame';
import { useVideoEditor } from '@/features/editor/useVideoEditor';

interface VideoEditorProps {
  file: File;
  label: string;
  edit: VideoEdit | undefined;
  onChange: (edit: VideoEdit | undefined) => void;
}

export function VideoEditor({ file, label, edit, onChange }: VideoEditorProps) {
  const {
    url,
    videoRef,
    containerRef,
    mode,
    currentTime,
    trim,
    crop,
    containerSize,
    duration,
    videoRect,
    trimActive,
    cropActive,
    handleTrimChange,
    handleCropChange,
    resetTrim,
    resetCrop,
    switchMode,
    seek,
    onLoadedMetadata,
    onTimeUpdate,
  } = useVideoEditor({ file, edit, onChange });

  return (
    <div className="glass-panel-dark rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground truncate">{label}</h3>
        <div className="flex gap-2">
          <ModeButton active={mode === 'trim'} dot={trimActive} onClick={() => { switchMode('trim'); }}>
            <Scissors className="w-4 h-4" />Trim
          </ModeButton>
          <ModeButton active={mode === 'crop'} dot={cropActive} onClick={() => { switchMode('crop'); }}>
            <Crop className="w-4 h-4" />Crop
          </ModeButton>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full bg-black rounded-xl overflow-hidden"
        style={{ height: 'min(55vh, 420px)' }}
      >
        <video
          ref={videoRef}
          src={url}
          aria-label="Video being edited"
          className="w-full h-full object-contain"
          controls={mode === 'trim'}
          playsInline
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
        />
        {mode === 'crop' && containerSize.width > 0 && (
          <CropFrame videoRect={videoRect} crop={crop} onChange={handleCropChange} />
        )}
      </div>

      <div className="mt-4">
        {mode === 'trim' ? (
          <>
            <TrimBar
              duration={duration}
              value={trim}
              currentTime={currentTime}
              onChange={handleTrimChange}
              onSeek={seek}
            />
            {trimActive && (
              <button onClick={resetTrim} className="mt-3 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-foreground transition-colors cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" />Reset trim
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Drag the frame or its corners to crop.</p>
            <button onClick={resetCrop} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-foreground transition-colors cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" />Reset crop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  dot,
  onClick,
  children,
}: {
  active: boolean;
  dot: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer',
        active ? 'bg-brand-500/20 text-brand-200 border border-brand-400/40' : 'text-gray-400 hover:text-foreground hover:bg-foreground/5 border border-transparent'
      )}
    >
      {children}
      {dot && <span aria-hidden="true" className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand-400" />}
    </button>
  );
}

export default VideoEditor;
