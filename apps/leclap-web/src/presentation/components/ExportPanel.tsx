import { useState, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Check, FileVideo, HardDrive, CheckCircle2 } from '@/presentation/components/icons';
import { DownloadIcon } from '@/presentation/components/icons/download';
import { CopyIcon } from '@/presentation/components/icons/copy';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
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

// Compact meta chip — keeps the file facts visible but secondary to the video preview above.
const MetaChip = ({ icon: Icon, label, value }: { icon: typeof HardDrive; label: string; value: string }) => (
  <span className="inline-flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-3 py-1.5 text-sm">
    <Icon className="h-4 w-4 text-brand-600 dark:text-brand-300" />
    <span className="text-gray-400">{label}</span>
    <span className="font-semibold tabular-nums text-foreground">{value}</span>
  </span>
);

const VideoInfo = ({ processedVideo }: VideoInfoProps) => {
  const { t } = useTranslation('process');

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <MetaChip icon={HardDrive} label={t('export.info.fileSize')} value={formatFileSize(processedVideo.size)} />
      {/* i18n-ignore */}
      <MetaChip icon={FileVideo} label={t('export.info.format')} value="MP4" />
    </div>
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
  const { ref: dlRef, hoverProps: dlHoverProps } = useIconHover();
  const { ref: copyRef, hoverProps: copyHoverProps } = useIconHover();

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
        {...dlHoverProps}
      >
        <span className="p-2 bg-foreground/20 rounded-lg [&_svg]:size-6">
          <DownloadIcon ref={dlRef} size={24} />
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
          {...copyHoverProps}
        >
          {showCopied ? (
            <>
              <Check className="!size-4 pop-in" />
              <span>{t('export.actions.copied')}</span>
            </>
          ) : (
            <>
              <CopyIcon ref={copyRef} size={16} />
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
    <Card elevation="flat" className="p-4 bg-surface/40 border-foreground/10 rounded-xl backdrop-blur-sm">
      <h4 className="font-medium text-gray-300 mb-2 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-success-foreground" /> {t('export.success.title')}
      </h4>
      <ul className="text-sm text-gray-400 space-y-1">
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

  const fallbackDownload = () => {
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
    link.download = `leclap-video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadProgress(0);
    }, 2000);
  };

  const handleDownload = () => {
    if (!('showSaveFilePicker' in window)) {
      fallbackDownload();

      return;
    }

    // `showSaveFilePicker` isn't in every TS DOM lib version, so the property is typed `unknown`;
    // assert the call signature (opts typed loosely for the same reason).
    const showSaveFilePicker = window.showSaveFilePicker as (opts?: unknown) => Promise<FileSystemFileHandle>;

    showSaveFilePicker({
      suggestedName: `leclap-video-${Date.now()}.mp4`,
      types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }],
    })
      .then(async (fileHandle) => {
        setDownloadProgress(10);
        const writable = await fileHandle.createWritable();
        setDownloadProgress(40);
        await writable.write(processedVideo.blob);
        setDownloadProgress(90);
        await writable.close();
        setDownloadProgress(100);
        setTimeout(() => {
          setDownloadProgress(0);
        }, 2000);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          fallbackDownload();
        }
      });
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
