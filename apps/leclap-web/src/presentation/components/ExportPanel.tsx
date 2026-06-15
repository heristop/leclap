import { useState, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Share2, Copy, Check, FileVideo, HardDrive, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { logger } from '@/lib/logger';
import { Button, Card } from '@/presentation/components/ui';
import { VideoPreview } from '@/presentation/components/VideoPreview';

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

interface VideoInfoProps {
  processedVideo: ProcessedVideo;
}

const VideoInfo = ({ processedVideo }: VideoInfoProps) => {
  const { t } = useTranslation('process');

  return (
    <Card
      elevation="flat"
      className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-surface/40 rounded-xl backdrop-blur-sm"
    >
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-info/20 rounded-lg border border-info/20">
          <HardDrive className="w-5 h-5 text-info" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-400">{t('export.info.fileSize')}</p>
          <p className="text-lg font-semibold text-foreground">{formatFileSize(processedVideo.size)}</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="p-2 bg-success/20 rounded-lg border border-success/20">
          <FileVideo className="w-5 h-5 text-success-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-400">{t('export.info.format')}</p>
          <p className="text-lg font-semibold text-foreground">MP4</p> {/* i18n-ignore */}
        </div>
      </div>
    </Card>
  );
};

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
}: ActionButtonsProps) => {
  const { t } = useTranslation('process');

  return (
    <div className="space-y-3">
      {/* Primary Download Button */}
      <Button
        onClick={onDownload}
        disabled={downloadProgress > 0 && downloadProgress < 100}
        size="lg"
        className={clsx(
          'w-full text-white hover:shadow-success/20 hover:scale-[1.02] focus-visible:ring-success/30',
          downloadProgress > 0 && downloadProgress < 100 && 'cursor-wait opacity-75'
        )}
      >
        <span className="p-2 bg-foreground/20 rounded-lg [&_svg]:size-6">
          <Download />
        </span>
        <span>
          {downloadProgress > 0 && downloadProgress < 100
            ? t('export.actions.downloading', { progress: downloadProgress })
            : t('export.actions.download')}
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
            showCopied && 'border-success/50 text-success-foreground bg-success/10'
          )}
        >
          {showCopied ? (
            <>
              <Check className="!size-4" />
              <span>{t('export.actions.copied')}</span>
            </>
          ) : (
            <>
              <Copy className="!size-4" />
              <span>{t('export.actions.copyLink')}</span>
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
            <span>{t('export.actions.share')}</span>
          </Button>
        )}
      </div>
    </div>
  );
};

const SuccessMessage = () => {
  const { t } = useTranslation('process');

  return (
    <Card elevation="flat" className="p-4 bg-success/[0.12] border-success/30 rounded-xl backdrop-blur-sm">
      <h4 className="font-semibold text-success-foreground mb-2 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> {t('export.success.title')}
      </h4>
      <ul className="text-sm text-success-foreground/80 space-y-1">
        <li>• {t('export.success.processed')}</li>
        <li>• {t('export.success.local')}</li>
        <li>• {t('export.success.noData')}</li>
        <li>• {t('export.success.downloadShare')}</li>
      </ul>
    </Card>
  );
};

export const ExportPanel = ({ processedVideo }: ExportPanelProps) => {
  const { t } = useTranslation('process');
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
        title: t('export.share.title'),
        text: t('export.share.text'),
        files: [file],
      })
      .catch((error: unknown) => {
        logger.error('Error sharing:', error);
      });
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Video Preview */}
      <VideoPreview url={processedVideo.url} duration={processedVideo.duration} />

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
