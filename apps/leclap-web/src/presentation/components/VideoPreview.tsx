import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { FileVideo, Volume2, VolumeX, Minimize2 } from '@/presentation/components/icons';
import { PlayIcon } from '@/presentation/components/icons/play';
import { PauseIcon } from '@/presentation/components/icons/pause';
import { Maximize2Icon } from '@/presentation/components/icons/maximize-2';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import clsx from 'clsx';
import { logger } from '@/lib/logger';

interface VideoPreviewProps {
  url: string;
  duration?: number;
  // Recorded-clip review (the camera preview) wants the take to start playing on its own and loop;
  // the export/result players keep the default click-to-play. Muted lets autoplay through unblocked.
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const ICON_BUTTON =
  'grid h-9 w-9 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 [&_svg]:size-4';

interface VolumeControlProps {
  isMuted: boolean;
  volume: number;
  onToggleMute: () => void;
  onChangeVolume: (v: number) => void;
  t: TFunction<'process'>;
}

// Mute toggle + a slider that reveals on hover/focus, so the bar stays compact but volume is one
// gesture away. The slider reads 0 while muted regardless of the retained volume.
const VolumeControl = ({ isMuted, volume, onToggleMute, onChangeVolume, t }: VolumeControlProps) => (
  <div className="group/vol flex items-center">
    <button
      type="button"
      onClick={onToggleMute}
      aria-label={isMuted ? t('export.preview.unmute') : t('export.preview.mute')}
      className={ICON_BUTTON}
    >
      {isMuted ? <VolumeX /> : <Volume2 />}
    </button>
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={isMuted ? 0 : volume}
      onChange={(e) => {
        onChangeVolume(Number(e.target.value));
      }}
      aria-label={t('export.preview.volume')}
      className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 accent-white transition-all duration-200 group-hover/vol:ml-1.5 group-hover/vol:w-16 group-hover/vol:opacity-100 focus-visible:ml-1.5 focus-visible:w-16 focus-visible:opacity-100"
    />
  </div>
);

interface PlayOverlayProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  t: TFunction<'process'>;
}

// The centered tap target: a play affordance that fades to a hover-only pause once the clip is running.
const PlayOverlay = ({ isPlaying, onPlayPause, t }: PlayOverlayProps) => {
  const { ref: playRef, hoverProps: playHoverProps } = useIconHover();
  const { ref: pauseRef, hoverProps: pauseHoverProps } = useIconHover();

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <button
        type="button"
        onClick={onPlayPause}
        aria-label={isPlaying ? t('export.preview.pause') : t('export.preview.play')}
        className={clsx(
          'pointer-events-auto grid h-16 w-16 place-items-center rounded-full border border-white/25 bg-black/45 text-white shadow-lg backdrop-blur-sm',
          'transition-all duration-200 ease-out hover:scale-105 hover:bg-black/60',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 [&_svg]:size-7',
          isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
        )}
        {...(isPlaying ? pauseHoverProps : playHoverProps)}
      >
        {isPlaying ? <PauseIcon ref={pauseRef} size={28} /> : <PlayIcon ref={playRef} size={28} className="ml-0.5" />}
      </button>
    </div>
  );
};

// Self-contained processed-video player: a tap-anywhere play/pause surface, a custom play overlay,
// and a controls bar with volume + fullscreen. Shared by the export panel and the onboarding result.
export const VideoPreview = ({ url, duration, autoPlay = false, loop = false, muted = false }: VideoPreviewProps) => {
  const { t } = useTranslation('process');
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { ref: maximizeRef, hoverProps: maximizeHoverProps } = useIconHover();

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handlePlayPause = () => {
    const el = videoRef.current;

    if (!el) return;

    if (el.paused) {
      el.play().catch((error: unknown) => {
        logger.error('Error playing video:', error);
      });

      return;
    }

    el.pause();
  };

  const toggleMute = () => {
    const el = videoRef.current;

    if (!el) return;

    el.muted = !el.muted;
    setIsMuted(el.muted);
  };

  const changeVolume = (next: number) => {
    const el = videoRef.current;

    if (!el) return;

    el.volume = next;
    el.muted = next === 0;
    setVolume(next);
    setIsMuted(next === 0);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((error: unknown) => {
        logger.error('Error exiting fullscreen:', error);
      });

      return;
    }

    containerRef.current?.requestFullscreen().catch((error: unknown) => {
      logger.error('Error entering fullscreen:', error);
    });
  };

  return (
    <div
      ref={containerRef}
      className={clsx(
        'group relative overflow-hidden bg-black shadow-2xl',
        isFullscreen
          ? 'flex h-full w-full items-center justify-center rounded-none border-0'
          : 'rounded-xl border border-foreground/10'
      )}
    >
      <video
        ref={videoRef}
        src={url}
        aria-label={t('export.preview.videoAriaLabel')}
        className={clsx('object-contain', isFullscreen ? 'h-full max-h-full w-full' : 'h-auto max-h-96 w-full')}
        onClick={handlePlayPause}
        onPlay={() => {
          setIsPlaying(true);
        }}
        onPause={() => {
          setIsPlaying(false);
        }}
        controls={false}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
        preload="metadata"
      />

      <PlayOverlay isPlaying={isPlaying} onPlayPause={handlePlayPause} t={t} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-12">
        <div className="flex items-center justify-between gap-3 text-sm text-white">
          <div className="flex min-w-0 items-center gap-2">
            <FileVideo className="h-4 w-4 shrink-0 text-brand-300" />
            <span className="truncate font-medium">{t('export.preview.label')}</span>
          </div>
          <div className="pointer-events-auto flex items-center gap-1">
            {duration && (
              <span className="mr-1 font-mono text-xs tabular-nums text-white/70">{formatDuration(duration)}</span>
            )}
            <VolumeControl
              isMuted={isMuted}
              volume={volume}
              onToggleMute={toggleMute}
              onChangeVolume={changeVolume}
              t={t}
            />
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? t('export.preview.exitFullscreen') : t('export.preview.enterFullscreen')}
              className={ICON_BUTTON}
              {...maximizeHoverProps}
            >
              {isFullscreen ? <Minimize2 /> : <Maximize2Icon ref={maximizeRef} size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
