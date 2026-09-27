import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Share2 } from '@/presentation/components/icons';
import { DownloadIcon } from '@/presentation/components/icons/download';
import { useIconHover } from '@/presentation/components/icons/useIconHover';
import { logger } from '@/lib/logger';
import { Button } from '@/presentation/components/ui';
import { formatBytes } from '@/presentation/components/builder/file-size';

interface ProcessedVideo {
  blob: Blob;
  url: string;
  size: number;
  duration?: number;
}

interface ExportPanelProps {
  processedVideo: ProcessedVideo;
  // What the file is saved and shared as (see downloadName).
  fileName: string;
  // The project title, used as the share sheet's title.
  title: string;
  // The render's frame size once the player has read it; the facts line leaves it out until then.
  frame: { width: number; height: number } | null;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'started';

// How long the "Saved" / "Download started" confirmation holds on the button before it resets.
const CONFIRM_MS = 2500;

// Whether the platform share sheet takes this file. `navigator.share` existing is not enough: most
// desktop browsers have it but refuse files, and a Share button that opens nothing is worse than none.
const canShareFile = (file: File): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

const anchorDownload = (url: string, fileName: string): void => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const DownloadLabel = ({ state }: { state: SaveState }) => {
  const { t } = useTranslation('process');

  if (state === 'saving') return <span>{t('export.actions.saving')}</span>;

  if (state === 'saved') return <span>{t('export.actions.saved')}</span>;

  if (state === 'started') return <span>{t('export.actions.started')}</span>;

  return <span>{t('export.actions.download')}</span>;
};

// The export rail of the result screen: the file's facts, then Download (the screen's one primary
// action) and — only where the platform can actually share a video file — Share. There is no "copy
// link": a render lives in this tab as a blob: URL, which opens nowhere else.
export const ExportPanel = ({ processedVideo, fileName, title, frame }: ExportPanelProps) => {
  const { t, i18n } = useTranslation('process');
  const [state, setState] = useState<SaveState>('idle');
  const resetTimer = useRef<number | null>(null);
  const { ref: downloadRef, hoverProps: downloadHoverProps } = useIconHover();
  const file = new File([processedVideo.blob], fileName, { type: 'video/mp4' });
  const shareable = canShareFile(file);

  const clearResetTimer = () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  };

  useEffect(() => clearResetTimer, []);

  const confirm = (next: 'saved' | 'started') => {
    setState(next);
    clearResetTimer();
    resetTimer.current = window.setTimeout(() => {
      setState('idle');
    }, CONFIRM_MS);
  };

  const fallbackDownload = () => {
    anchorDownload(processedVideo.url, fileName);
    confirm('started');
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
      suggestedName: fileName,
      types: [{ description: t('export.fileType'), accept: { 'video/mp4': ['.mp4'] } }],
    })
      .then(async (fileHandle) => {
        setState('saving');
        const writable = await fileHandle.createWritable();
        await writable.write(processedVideo.blob);
        await writable.close();
        confirm('saved');
      })
      .catch((error: unknown) => {
        // Dismissing the save dialog is a choice, not a failure: leave the button as it was.
        if (error instanceof Error && error.name === 'AbortError') {
          setState('idle');

          return;
        }

        fallbackDownload();
      });
  };

  const handleShare = () => {
    navigator.share({ title, text: t('export.share.text'), files: [file] }).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return;

      logger.error('Error sharing:', error);
    });
  };

  const facts = [
    // i18n-ignore — the container format's name, the same in every language.
    'MP4',
    frame ? `${frame.width}×${frame.height}` : null,
    formatBytes(processedVideo.size, i18n.language),
  ].filter(Boolean);
  const confirmed = state === 'saved' || state === 'started';

  return (
    <div className="space-y-3">
      <p className="text-sm tabular-nums text-muted-foreground">{facts.join(' · ')}</p>

      <Button
        size="lg"
        onClick={handleDownload}
        disabled={state === 'saving'}
        className="w-full [&_svg]:size-5"
        {...downloadHoverProps}
      >
        {confirmed ? <Check className="pop-in" /> : <DownloadIcon ref={downloadRef} size={20} />}
        <DownloadLabel state={state} />
      </Button>
      {/* The button's label change isn't announced on its own; this is. */}
      <span className="sr-only" role="status" aria-live="polite">
        {confirmed ? <DownloadLabel state={state} /> : null}
      </span>

      {shareable && (
        <Button variant="secondary" onClick={handleShare} className="w-full [&_svg]:size-4">
          <Share2 />
          {t('actions.share', { ns: 'common' })}
        </Button>
      )}
    </div>
  );
};
