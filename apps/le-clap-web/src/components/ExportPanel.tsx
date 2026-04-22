import { useState, useRef, startTransition } from 'react'
import { Download, Play, Pause, Share2, Copy, Check, FileVideo, HardDrive } from 'lucide-react'
import clsx from 'clsx'
import { logger } from '../lib/logger'

interface ProcessedVideo {
  blob: Blob
  url: string
  size: number
  duration?: number
}

interface ExportPanelProps {
  processedVideo: ProcessedVideo
}

export const ExportPanel = ({ processedVideo }: ExportPanelProps) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showCopied, setShowCopied] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleDownload = () => {
    // Show visual feedback during download
    setDownloadProgress(0)
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 50)

    // Actual download
    const link = document.createElement('a')
    link.href = processedVideo.url
    link.download = `processed-video-${Date.now()}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => setDownloadProgress(0), 2000)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(processedVideo.url)
      startTransition(() => {
        setShowCopied(true)
      })
      setTimeout(() => setShowCopied(false), 2000)
    } catch (err) {
      logger.error('Failed to copy:', err)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const file = new File([processedVideo.blob], 'processed-video.mp4', {
          type: 'video/mp4'
        })
        await navigator.share({
          title: 'Processed Video',
          text: 'Check out this video I created with FFmpeg Video Composer!',
          files: [file]
        })
      } catch (err) {
        logger.error('Error sharing:', err)
      }
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Video Preview */}
      <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
        <video
          ref={videoRef}
          src={processedVideo.url}
          className="w-full h-auto max-h-96 object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          controls={false}
          preload="metadata"
        />

        {/* Custom Play/Pause Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button
            onClick={handlePlayPause}
            className={clsx(
              "p-4 bg-black/50 rounded-full text-white transition-all duration-200 pointer-events-auto backdrop-blur-sm border border-white/10 cursor-pointer",
              isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100 hover:scale-110 hover:bg-black/70"
            )}
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8" />
            ) : (
              <Play className="w-8 h-8 ml-1" />
            )}
          </button>
        </div>

        {/* Video Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
          <div className="flex items-center justify-between text-white text-sm">
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

      {/* Video Information */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-800/40 border border-white/10 rounded-xl backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/20">
            <HardDrive className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400">File Size</p>
            <p className="text-lg font-semibold text-white">
              {formatFileSize(processedVideo.size)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-500/20 rounded-lg border border-green-500/20">
            <FileVideo className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400">Format</p>
            <p className="text-lg font-semibold text-white">MP4</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Primary Download Button */}
        <button
          onClick={handleDownload}
          disabled={downloadProgress > 0 && downloadProgress < 100}
          className={clsx(
            'w-full flex items-center justify-center space-x-3 px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200',
            'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500',
            'focus:outline-none focus:ring-4 focus:ring-green-500/30 hover:scale-[1.02] shadow-lg hover:shadow-green-500/20 cursor-pointer',
            downloadProgress > 0 && downloadProgress < 100 && 'cursor-wait opacity-75'
          )}
        >
          <div className="p-2 bg-white/20 rounded-lg">
            <Download className="w-6 h-6" />
          </div>
          <span>
            {downloadProgress > 0 && downloadProgress < 100
              ? `Downloading... ${downloadProgress}%`
              : 'Download Video'
            }
          </span>
        </button>

        {/* Progress Bar for Download */}
        {downloadProgress > 0 && downloadProgress < 100 && (
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        )}

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopyLink}
            className={clsx(
              'flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer',
              'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/20',
              showCopied && 'border-green-500/50 text-green-400 bg-green-500/10'
            )}
          >
            {showCopied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          {'share' in navigator && (
            <button
              onClick={handleShare}
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/20 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Message */}
      <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl backdrop-blur-sm">
        <h4 className="font-semibold text-green-400 mb-2 flex items-center">
          <span className="mr-2">🎉</span> Video Processing Complete!
        </h4>
        <ul className="text-sm text-green-200/70 space-y-1">
          <li>• Your video has been processed</li>
          <li>• All processing was done locally in your browser</li>
          <li>• No data was sent to external servers</li>
          <li>• You can download and share your video now</li>
        </ul>
      </div>
    </div>
  )
}