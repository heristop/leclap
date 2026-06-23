import { useEffect, useRef } from 'react';
import { Crop, Scissors, RotateCcw, Trash2, Undo2, Redo2 } from '@/presentation/components/icons';
import { PlayIcon } from '@/presentation/components/icons/play';
import { PauseIcon } from '@/presentation/components/icons/pause';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/presentation/components/ui';
import { type VideoEdit } from '@/domain/valueObjects/videoEdits';
import { CropFrame } from '@/features/editor/components/CropFrame';
import { Timeline } from '@/features/editor/components/Timeline';
import { useTimelineEditor } from '@/features/editor/useTimelineEditor';

interface TimelineEditorProps {
  file: File;
  label: string;
  edit: VideoEdit | undefined;
  onChange: (edit: VideoEdit | undefined) => void;
}

const fmtClock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));

  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
};

export function TimelineEditor({ file, label, edit, onChange }: TimelineEditorProps) {
  const e = useTimelineEditor({ file, edit, onChange });
  const canDelete = e.segments.length > 1;
  const { ref: playRef, hoverProps: playHoverProps } = useIconHover();
  const { ref: pauseRef, hoverProps: pauseHoverProps } = useIconHover();

  const undoRef = useRef(e.undo);
  const redoRef = useRef(e.redo);
  undoRef.current = e.undo;
  redoRef.current = e.redo;

  useEffect(() => {
    const handleKey = (ev: KeyboardEvent) => {
      const modKey = ev.metaKey || ev.ctrlKey;

      if (!modKey || ev.key.toLowerCase() !== 'z') return;

      ev.preventDefault();

      if (ev.shiftKey) {
        redoRef.current();

        return;
      }

      undoRef.current();
    };

    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div className="glass-panel-dark rounded-2xl p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="truncate font-display font-semibold text-foreground">{label}</h3>
        <div className="flex gap-2">
          <ModeButton
            active={e.mode === 'timeline'}
            dot={e.timelineActive}
            onClick={() => {
              e.switchMode('timeline');
            }}
          >
            <Scissors className="h-4 w-4" />
            Edit
          </ModeButton>
          <ModeButton
            active={e.mode === 'crop'}
            dot={e.cropActive}
            onClick={() => {
              e.switchMode('crop');
            }}
          >
            <Crop className="h-4 w-4" />
            Crop
          </ModeButton>
        </div>
      </div>

      <div
        ref={e.containerRef}
        className="relative w-full overflow-hidden rounded-xl bg-black"
        style={{ height: 'min(55vh, 420px)' }}
      >
        <video
          ref={e.videoRef}
          src={e.url || undefined}
          aria-label="Video being edited"
          className="h-full w-full object-contain"
          playsInline
          onLoadedMetadata={e.onLoadedMetadata}
          onTimeUpdate={e.onTimeUpdate}
        />
        {e.mode === 'crop' && e.containerSize.width > 0 && (
          <CropFrame videoRect={e.videoRect} crop={e.crop} onChange={e.handleCropChange} />
        )}
      </div>

      {e.mode === 'timeline' ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={e.togglePlay}
                aria-label={e.playing ? 'Pause' : 'Play'}
                className="rounded-full [&_svg]:size-4"
                {...(e.playing ? pauseHoverProps : playHoverProps)}
              >
                {e.playing ? (
                  <PauseIcon ref={pauseRef} size={16} />
                ) : (
                  <PlayIcon ref={playRef} size={16} className="translate-x-px" />
                )}
              </Button>
              <span className="text-sm tabular-nums text-gray-300">
                {fmtClock(e.outputPosition)} <span className="text-gray-500">/ {fmtClock(e.outputDuration)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={e.undo}
                disabled={!e.canUndo}
                aria-label="Undo"
                title="Undo (⌘Z)"
                className="text-gray-400 hover:text-foreground [&_svg]:size-4"
              >
                <Undo2 />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={e.redo}
                disabled={!e.canRedo}
                aria-label="Redo"
                title="Redo (⌘⇧Z)"
                className="text-gray-400 hover:text-foreground [&_svg]:size-4"
              >
                <Redo2 />
              </Button>
              <Button variant="secondary" size="sm" onClick={e.split} className="gap-1.5 [&_svg]:size-4">
                <Scissors />
                Split
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (e.selectedId) e.remove(e.selectedId);
                }}
                disabled={!canDelete}
                aria-label="Delete segment"
                className="gap-1.5 text-gray-400 hover:text-[var(--color-error)] [&_svg]:size-4"
              >
                <Trash2 />
              </Button>
            </div>
          </div>

          <Timeline
            segments={e.segments}
            selectedId={e.selectedId}
            duration={e.duration}
            sourceTime={e.sourceTime}
            onSelect={e.setSelectedId}
            onSeekSource={e.seekSource}
            onTrim={e.trim}
            onSetSpeed={e.setSpeed}
            onSplitAt={e.splitAtSource}
            onDelete={e.remove}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Drag the handles to trim · tap <span className="font-semibold text-gray-400">Split</span> to cut ·
              right-click a clip for speed.
            </p>
            {e.timelineActive && (
              <div className="flex items-center gap-3">
                <Button
                  variant="link"
                  size="sm"
                  onClick={e.inverse}
                  className="gap-1.5 px-0 font-medium text-gray-400 no-underline hover:text-foreground hover:no-underline [&_svg]:size-3.5"
                >
                  <ArrowRightLeft />
                  Inverse
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  onClick={e.resetTimeline}
                  className="gap-1.5 px-0 font-medium text-gray-400 no-underline hover:text-foreground hover:no-underline [&_svg]:size-3.5"
                >
                  <RotateCcw />
                  Reset
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-400">Drag the frame or its corners to crop.</p>
          <Button
            variant="link"
            size="sm"
            onClick={e.resetCrop}
            className="gap-1.5 px-0 font-medium text-gray-400 no-underline hover:text-foreground hover:no-underline [&_svg]:size-3.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset crop
          </Button>
        </div>
      )}
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
        'tap relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95',
        active
          ? 'border-brand-400/50 bg-gradient-to-r from-brand-500/25 to-secondary-500/20 text-brand-700 shadow-md shadow-brand-500/25 dark:text-brand-100'
          : 'border-transparent text-gray-400 hover:bg-foreground/5 hover:text-foreground'
      )}
    >
      {children}
      {dot && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-brand-400 shadow shadow-brand-500/50"
        />
      )}
    </button>
  );
}

export default TimelineEditor;
