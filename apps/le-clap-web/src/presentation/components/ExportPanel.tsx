import { useState, useRef, startTransition } from 'react';
import { Download, Play, Pause, Share2, Copy, Check, FileVideo, HardDrive, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { logger } from '@/lib/logger';
import { Button, Card } from '@/presentation/components/ui';

interface ProcessedVideo {
  blob: Blob;
  url: string;
  size: number;
  duration?: number;
}

interface ExportPanelProps {
  processedVideo: ProcessedVideo;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface VideoPreviewProps {
  processedVideo: ProcessedVideo;
  isPlaying: boolean;
  onPlayPause: () => void;
  onPlay: () => void;
  onPause: () => void;
}

const VideoPreview = ({ processedVideo, isPlaying, onPlayPause, onPlay, onPause }: VideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      onPlayPause();

      return;
    }

    videoRef.current.play().catch((error: unknown) => {
      logger.error('Error playing video:', error);
    });
    onPlayPause();
  };

  return (
    <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl border border-foreground/10">
      <video
        ref={videoRef}
        src={processedVideo.url}
        aria-label="Processed video preview"
        className="w-full h-auto max-h-96 object-contain"
        onPlay={() => {
          onPlay();
        }}
        onPause={() => {
          onPause();
        }}
        controls={false}
        preload="metadata"
      />

      {/* Custom Play/Pause Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePlayPause}
          className={clsx(
            'p-4 bg-black/50 rounded-full text-foreground pointer-events-auto backdrop-blur-sm border border-foreground/10 hover:bg-black/70 [&_svg]:size-8',
            isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100 hover:scale-110'
          )}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
        >
          {isPlaying ? <Pause /> : <Play className="ml-1" />}
        </Button>
      </div>

      {/* Video Controls Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
        <div className="flex items-center justify-between text-foreground text-sm">
          <div className="flex items-center space-x-2">
            <FileVideo className="w-4 h-4 text-brand-400" />
            <span className="font-medium">Processed Video</span>
          </div>
          {processedVideo.duration && (
            <span className="font-mono text-gray-300">{formatDuration(processedVideo.duration)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

interface VideoInfoProps {
  processedVideo: ProcessedVideo;
}

const VideoInfo = ({ processedVideo }: VideoInfoProps) => (
  <Card
    elevation="flat"
    className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-surface/40 rounded-xl backdrop-blur-sm"
  >
    <div className="flex items-center space-x-3">
      <div className="p-2 bg-info/20 rounded-lg border border-info/20">
        <HardDrive className="w-5 h-5 text-info" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-400">File Size</p>
        <p className="text-lg font-semibold text-foreground">{formatFileSize(processedVideo.size)}</p>
      </div>
    </div>

    <div className="flex items-center space-x-3">
      <div className="p-2 bg-success/20 rounded-lg border border-success/20">
        <FileVideo className="w-5 h-5 text-success" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-400">Format</p>
        <p className="text-lg font-semibold text-foreground">MP4</p>
      </div>
    </div>
  </Card>
);

interface ActionButtonsProps {
  processedVideo: ProcessedVideo;
  downloadProgress: number;
  showCopied: boolean;
  onDownload: () => void;
  onCopyLink: () => void;
  onShare: () => void;
}

const ActionButtons = ({
  processedVideo: _processedVideo,
  downloadProgress,
  showCopied,
  onDownload,
  onCopyLink,
  onShare,
}: ActionButtonsProps) => (
  <div className="space-y-3">
    {/* Primary Download Button */}
    <Button
      onClick={onDownload}
      disabled={downloadProgress > 0 && downloadProgress < 100}
      size="lg"
      className={clsx(
        'w-full bg-success text-white hover:shadow-success/20 hover:scale-[1.02] focus-visible:ring-success/30',
        downloadProgress > 0 && downloadProgress < 100 && 'cursor-wait opacity-75'
      )}
    >
      <span className="p-2 bg-foreground/20 rounded-lg [&_svg]:size-6">
        <Download />
      </span>
      <span>
        {downloadProgress > 0 && downloadProgress < 100 ? `Downloading... ${downloadProgress}%` : 'Download Video'}
      </span>
    </Button>

    {/* Progress Bar for Download */}
    {downloadProgress > 0 && downloadProgress < 100 && (
      <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
        <div className="h-full bg-success transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
      </div>
    )}

    {/* Secondary Actions */}
    <div className="grid grid-cols-2 gap-3">
      <Button
        variant="outline"
        onClick={onCopyLink}
        className={clsx(
          'px-4 py-3 bg-foreground/5 hover:bg-foreground/10 hover:border-foreground/20',
          showCopied && 'border-success/50 text-success bg-success/10'
        )}
      >
        {showCopied ? (
          <>
            <Check className="!size-4" />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Copy className="!size-4" />
            <span>Copy Link</span>
          </>
        )}
      </Button>

      {'share' in navigator && (
        <Button
          variant="outline"
          onClick={onShare}
          className="px-4 py-3 bg-foreground/5 hover:bg-foreground/10 hover:border-foreground/20"
        >
          <Share2 className="!size-4" />
          <span>Share</span>
        </Button>
      )}
    </div>
  </div>
);

const SuccessMessage = () => (
  <Card elevation="flat" className="p-4 bg-success/[0.12] border-success/30 rounded-xl backdrop-blur-sm">
    <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4" /> Video Processing Complete!
    </h4>
    <ul className="text-sm text-success/80 space-y-1">
      <li>• Your video has been processed</li>
      <li>• All processing was done locally in your browser</li>
      <li>• No data was sent to external servers</li>
      <li>• You can download and share your video now</li>
    </ul>
  </Card>
);

export const ExportPanel = ({ processedVideo }: ExportPanelProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownload = () => {
    setDownloadProgress(0);
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);

          return 100;
        }

        return prev + 10;
      });
    }, 50);

    const link = document.createElement('a');
    link.href = processedVideo.url;
    link.download = `processed-video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadProgress(0);
    }, 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(processedVideo.url)
      .then(() => {
        startTransition(() => {
          setShowCopied(true);
        });
        setTimeout(() => {
          setShowCopied(false);
        }, 2000);
      })
      .catch((error: unknown) => {
        logger.error('Failed to copy:', error);
      });
  };

  const handleShare = () => {
    if (!('share' in navigator)) return;
    const file = new File([processedVideo.blob], 'processed-video.mp4', {
      type: 'video/mp4',
    });
    navigator
      .share({
        title: 'Processed Video',
        text: 'Check out this video I created with FFmpeg Video Composer!',
        files: [file],
      })
      .catch((error: unknown) => {
        logger.error('Error sharing:', error);
      });
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Video Preview */}
      <VideoPreview
        processedVideo={processedVideo}
        isPlaying={isPlaying}
        onPlayPause={() => {
          setIsPlaying((prev) => !prev);
        }}
        onPlay={() => {
          setIsPlaying(true);
        }}
        onPause={() => {
          setIsPlaying(false);
        }}
      />

      {/* Video Information */}
      <VideoInfo processedVideo={processedVideo} />

      {/* Action Buttons */}
      <ActionButtons
        processedVideo={processedVideo}
        downloadProgress={downloadProgress}
        showCopied={showCopied}
        onDownload={handleDownload}
        onCopyLink={handleCopyLink}
        onShare={handleShare}
      />

      {/* Success Message */}
      <SuccessMessage />
    </div>
  );
};
